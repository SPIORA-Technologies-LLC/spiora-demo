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

  it("accepts WebM audio (EBML) and MP4 video (ftyp)", () => {
    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    const audio = validateKbAttachmentFile({
      fileName: "note.webm",
      contentType: "audio/webm",
      size: webm.length,
      buffer: webm,
    });
    assert.equal(audio.ok, true);
    if (audio.ok) assert.equal(audio.kind, "audio");

    const mp4 = Buffer.alloc(16);
    mp4.writeUInt32BE(16, 0);
    mp4.write("ftyp", 4);
    mp4.write("isom", 8);
    const video = validateKbAttachmentFile({
      fileName: "clip.mp4",
      contentType: "video/mp4",
      size: mp4.length,
      buffer: mp4,
    });
    assert.equal(video.ok, true);
    if (video.ok) {
      assert.equal(video.kind, "video");
      assert.equal(video.mimeType, "video/mp4");
    }
  });

  it("accepts MP3 and rejects video declared as PDF", () => {
    const mp3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0, 0, 0, 0]);
    const ok = validateKbAttachmentFile({
      fileName: "voice.mp3",
      contentType: "audio/mpeg",
      size: mp3.length,
      buffer: mp3,
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.kind, "audio");

    const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
    const mismatch = validateKbAttachmentFile({
      fileName: "x.pdf",
      contentType: "application/pdf",
      size: webm.length,
      buffer: webm,
    });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.error, "mime_mismatch");
  });

  it("denies oversized video", () => {
    const mp4 = Buffer.alloc(16);
    mp4.writeUInt32BE(16, 0);
    mp4.write("ftyp", 4);
    mp4.write("isom", 8);
    const result = validateKbAttachmentFile({
      fileName: "big.mp4",
      contentType: "video/mp4",
      size: 101 * 1024 * 1024,
      buffer: mp4,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "file_too_large");
  });

  it("storage path is UUID + ext only (no traversal)", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    assert.equal(buildKbStoragePath(id, "application/pdf"), `${id}.pdf`);
    assert.equal(buildKbStoragePath(id, "video/mp4"), `${id}.mp4`);
    assert.equal(buildKbStoragePath(id, "audio/webm"), `${id}.webm`);
    assert.equal(buildKbStoragePath(id, "audio/mpeg"), `${id}.mp3`);
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

  it("migration 029 widens MIME/size/path and private bucket for media", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/029_knowledge_base_media_attachments.sql"),
      "utf8",
    );
    assert.match(sql, /video\/mp4/);
    assert.match(sql, /audio\/webm/);
    assert.match(sql, /104857600/);
    assert.match(sql, /mp4\|webm\|ogg\|mp3\|m4a/);
    assert.match(sql, /knowledge-base/);
  });

  it("download route supports Range for media seeking", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const itemRoute = readFileSync(
      join(
        process.cwd(),
        "src/app/api/knowledge-base/[slug]/attachments/[attachmentId]/route.ts",
      ),
      "utf8",
    );
    assert.match(itemRoute, /Accept-Ranges/);
    assert.match(itemRoute, /Content-Range/);
    assert.match(itemRoute, /status: 206/);
  });
});
