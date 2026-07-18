import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKbStoragePath,
  isBlockedExtension,
  sniffKbAttachmentMime,
  validateKbAttachmentFile,
} from "@/lib/knowledge-base/attachment-formats.ts";

function pdfBuffer(extra = ""): Buffer {
  return Buffer.from(`%PDF-1.4\n${extra}`);
}

function pngBuffer(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
}

describe("KB attachment validation Phase 1", () => {
  it("accepts PDF within size limit", () => {
    const buffer = pdfBuffer("content");
    const result = validateKbAttachmentFile({
      fileName: "guide.pdf",
      contentType: "application/pdf",
      size: buffer.length,
      buffer,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, "application/pdf");
      assert.equal(result.kind, "pdf");
    }
  });

  it("accepts PNG/JPEG/WebP", () => {
    const png = pngBuffer();
    assert.equal(
      validateKbAttachmentFile({
        fileName: "a.png",
        contentType: "image/png",
        size: png.length,
        buffer: png,
      }).ok,
      true,
    );

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    assert.equal(
      validateKbAttachmentFile({
        fileName: "a.jpg",
        contentType: "image/jpeg",
        size: jpeg.length,
        buffer: jpeg,
      }).ok,
      true,
    );

    const webp = Buffer.alloc(16);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    assert.equal(
      validateKbAttachmentFile({
        fileName: "a.webp",
        contentType: "image/webp",
        size: webp.length,
        buffer: webp,
      }).ok,
      true,
    );
  });

  it("denies SVG and executables", () => {
    assert.equal(isBlockedExtension("icon.svg"), true);
    assert.equal(isBlockedExtension("run.exe"), true);
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const result = validateKbAttachmentFile({
      fileName: "x.png",
      contentType: "image/png",
      size: svg.length,
      buffer: svg,
    });
    assert.equal(result.ok, false);
  });

  it("denies DOCX/CSV for Phase 1", () => {
    const buffer = Buffer.from("PK\u0003\u0004fake");
    const result = validateKbAttachmentFile({
      fileName: "doc.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: buffer.length,
      buffer,
    });
    assert.equal(result.ok, false);
  });

  it("denies oversized PDF", () => {
    const buffer = pdfBuffer("x");
    const result = validateKbAttachmentFile({
      fileName: "big.pdf",
      contentType: "application/pdf",
      size: 26 * 1024 * 1024,
      buffer,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "file_too_large");
  });

  it("detects MIME mismatch", () => {
    const buffer = pngBuffer();
    const result = validateKbAttachmentFile({
      fileName: "a.pdf",
      contentType: "application/pdf",
      size: buffer.length,
      buffer,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "mime_mismatch");
  });

  it("storage path is UUID + ext only (no traversal)", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(buildKbStoragePath(id, "application/pdf"), `${id}.pdf`);
    assert.doesNotMatch(buildKbStoragePath(id, "image/png"), /\.\.|\/|\\/);
  });

  it("sniff rejects HTML pretending to be image", () => {
    assert.equal(sniffKbAttachmentMime(Buffer.from("<!doctype html><html>")), "");
  });
});

describe("KB attachment policy shape", () => {
  it("migration 027 defines table, RLS, private bucket, hard-delete block", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/027_knowledge_base_attachments.sql"),
      "utf8",
    );
    assert.match(sql, /create table if not exists public\.knowledge_base_attachments/i);
    assert.match(sql, /spiora_block_hard_delete/i);
    assert.match(sql, /rls_kb_attachments_select_published/i);
    assert.match(sql, /knowledge-base/);
    assert.match(sql, /public = false|false,/i);
    assert.doesNotMatch(sql, /image\/svg/i);
    assert.match(sql, /application\/pdf/);
  });

  it("API routes exist for list/upload and download/archive", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    assert.equal(
      existsSync(
        join(process.cwd(), "src/app/api/knowledge-base/[slug]/attachments/route.ts"),
      ),
      true,
    );
    assert.equal(
      existsSync(
        join(
          process.cwd(),
          "src/app/api/knowledge-base/[slug]/attachments/[attachmentId]/route.ts",
        ),
      ),
      true,
    );
  });

  it("upload route enforces owner and denies hard DELETE export", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const listRoute = readFileSync(
      join(process.cwd(), "src/app/api/knowledge-base/[slug]/attachments/route.ts"),
      "utf8",
    );
    const itemRoute = readFileSync(
      join(
        process.cwd(),
        "src/app/api/knowledge-base/[slug]/attachments/[attachmentId]/route.ts",
      ),
      "utf8",
    );
    assert.match(listRoute, /session\.role !== "owner"/);
    assert.match(listRoute, /isKbUploadDisabled/);
    assert.doesNotMatch(itemRoute, /export async function DELETE/);
    assert.match(itemRoute, /action === "archive"/);
    assert.match(itemRoute, /Cache-Control": "private/);
  });
});
