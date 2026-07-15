import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeNextDemoDocumentExternalId,
  formatDemoDocumentExternalId,
  isDuplicateDocumentExternalIdError,
  parseDemoDocumentSequence,
} from "./document-external-id.ts";
import { toPublicDocument } from "../supabase/client-documents-repo.ts";
import type { ClientDocumentRecord } from "./client-data-types.ts";

describe("document external_id generator", () => {
  it("max DOC-DEMO-0016 → DOC-DEMO-0017", () => {
    const ids = Array.from({ length: 16 }, (_, i) =>
      formatDemoDocumentExternalId(i + 1, 3),
    );
    assert.equal(computeNextDemoDocumentExternalId(ids), "DOC-DEMO-0017");
  });

  it("после 0017 → 0018", () => {
    assert.equal(
      computeNextDemoDocumentExternalId([
        "DOC-DEMO-001",
        "DOC-DEMO-016",
        "DOC-DEMO-0017",
      ]),
      "DOC-DEMO-0018",
    );
  });

  it("учитывает archived ID в списке", () => {
    assert.equal(
      computeNextDemoDocumentExternalId([
        "DOC-DEMO-0016",
        "DOC-DEMO-0017", // archived runtime
      ]),
      "DOC-DEMO-0018",
    );
  });

  it("lexical trap: 0099 → 0100", () => {
    assert.equal(
      computeNextDemoDocumentExternalId(["DOC-DEMO-0099", "DOC-DEMO-0100"]),
      "DOC-DEMO-0101",
    );
    assert.equal(
      computeNextDemoDocumentExternalId(["DOC-DEMO-99", "DOC-DEMO-100"]),
      "DOC-DEMO-0101",
    );
  });

  it("не зависит от lexical sort порядка входных id", () => {
    // Lexical desc put DOC-DEMO-016 above DOC-DEMO-0017 wrongly for next-calc
    assert.equal("DOC-DEMO-016" > "DOC-DEMO-0017", true);
    assert.equal(
      computeNextDemoDocumentExternalId([
        "DOC-DEMO-016",
        "DOC-DEMO-0017",
        "DOC-DEMO-002",
      ]),
      "DOC-DEMO-0018",
    );
  });

  it("parse/format helpers", () => {
    assert.equal(parseDemoDocumentSequence("DOC-DEMO-0017"), 17);
    assert.equal(parseDemoDocumentSequence("not-demo"), null);
    assert.equal(formatDemoDocumentExternalId(7), "DOC-DEMO-0007");
  });

  it("recognizes unique conflict errors", () => {
    assert.equal(
      isDuplicateDocumentExternalIdError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "client_documents_external_id_uidx"',
      }),
      true,
    );
    assert.equal(
      isDuplicateDocumentExternalIdError({ code: "23505", message: "other" }),
      false,
    );
    assert.equal(isDuplicateDocumentExternalIdError({ code: "42P01" }), false);
  });
});

describe("public document mapping", () => {
  it("не содержит storage internals", () => {
    const record: ClientDocumentRecord = {
      id: "uuid-1",
      clientId: "DEMO-1001",
      externalId: "DOC-DEMO-0018",
      name: "a.pdf",
      originalFileName: "a.pdf",
      mimeType: "application/pdf",
      sizeBytes: 10,
      documentType: "other",
      status: "uploaded",
      storageProvider: "demo",
      storageState: "demo",
      uploadedByName: "Olivia",
      uploadedAt: "2026-07-15T00:00:00Z",
    };
    const pub = toPublicDocument(record);
    assert.equal("storageProvider" in pub, false);
    assert.equal("storagePath" in pub, false);
    assert.equal("storageBucket" in pub, false);
    assert.equal("metadata" in pub, false);
  });
});

describe("concurrent unique conflict → retry semantics", () => {
  it("simulate race: generator sees stale max, conflict detector fires, next attempt advances", () => {
    const existing = ["DOC-DEMO-0016", "DOC-DEMO-0017"];
    const firstGuess = computeNextDemoDocumentExternalId(["DOC-DEMO-0016"]);
    assert.equal(firstGuess, "DOC-DEMO-0017");
    assert.equal(existing.includes(firstGuess), true);
    assert.equal(
      isDuplicateDocumentExternalIdError({
        code: "23505",
        message: "client_documents_external_id_uidx",
      }),
      true,
    );
    const afterRetry = computeNextDemoDocumentExternalId(existing);
    assert.equal(afterRetry, "DOC-DEMO-0018");
  });
});
