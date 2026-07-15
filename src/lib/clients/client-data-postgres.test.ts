import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  ClientDataValidationError,
  sanitizeFileName,
  validateCreateDocumentMetadataInput,
  validateDocumentStatus,
  validateDocumentType,
  validateMimeType,
  validateNoteContent,
  validateSizeBytes,
  validateStoragePath,
} from "./client-data-validation.ts";
import {
  canArchiveClientDocument,
  canArchiveClientNote,
  canCreateClientDocument,
  canCreateClientNote,
  canUpdateClientDocument,
  canUpdateClientNote,
} from "./client-data-permissions.ts";
import {
  mapDocumentPublicToClientDocument,
  mapNoteRecordToClientNote,
} from "./client-data-map.ts";
import { buildClientAiContext } from "./ai-context.ts";
import { toPublicDocument } from "../supabase/client-documents-repo.ts";
import type { ClientDocumentRecord } from "./client-data-types.ts";
import { isCrmLegacyFallbackAllowed } from "./config.ts";

describe("client notes validation", () => {
  it("принимает непустой текст заметки", () => {
    assert.equal(validateNoteContent("  Hello  "), "Hello");
  });

  it("отклоняет пустую заметку", () => {
    assert.throws(() => validateNoteContent("   "), ClientDataValidationError);
  });

  it("сохраняет XSS-контент как plain text (не экранирует — рендер без HTML)", () => {
    const raw = '<script>alert("x")</script>';
    assert.equal(validateNoteContent(raw), raw);
  });
});

describe("client documents validation", () => {
  it("санитизирует имя файла и отклоняет path traversal", () => {
    assert.equal(sanitizeFileName("passport.pdf"), "passport.pdf");
    assert.throws(() => sanitizeFileName("../etc/passwd"), ClientDataValidationError);
    assert.throws(() => sanitizeFileName('bad"name.pdf'), ClientDataValidationError);
  });

  it("валидирует MIME type", () => {
    assert.equal(validateMimeType("application/pdf"), "application/pdf");
    assert.throws(() => validateMimeType("not-a-mime"), ClientDataValidationError);
  });

  it("принимает machine keys типов и статусов", () => {
    assert.equal(validateDocumentType("passport_copy"), "passport_copy");
    assert.equal(validateDocumentStatus("under_review"), "under_review");
    assert.throws(() => validateDocumentType("Passport Copy"), ClientDataValidationError);
  });

  it("отклоняет невалидный размер", () => {
    assert.throws(() => validateSizeBytes(-1), ClientDataValidationError);
    assert.throws(() => validateSizeBytes(Number.MAX_SAFE_INTEGER), ClientDataValidationError);
    assert.equal(validateSizeBytes(1024), 1024);
  });

  it("отклоняет небезопасный storage_path", () => {
    assert.throws(
      () => validateStoragePath("https://evil.example/leak"),
      ClientDataValidationError,
    );
    assert.throws(() => validateStoragePath("../secret"), ClientDataValidationError);
    assert.equal(validateStoragePath("demo/clients/DEMO-1001/file.pdf"), "demo/clients/DEMO-1001/file.pdf");
  });

  it("create metadata defaults to safe values", () => {
    const result = validateCreateDocumentMetadataInput({
      fileName: "scan.pdf",
    });
    assert.equal(result.mimeType, "application/pdf");
    assert.equal(result.status, "uploaded");
    assert.equal(result.storageProvider, "demo");
  });
});

describe("client data permissions", () => {
  const manager = {
    id: "m1",
    email: "m@example.com",
    name: "Manager",
    role: "manager" as const,
  };
  const owner = { ...manager, id: "o1", role: "owner" as const };

  it("owner и manager могут CRUD notes", () => {
    assert.equal(canCreateClientNote(manager), true);
    assert.equal(canUpdateClientNote(owner), true);
    assert.equal(canArchiveClientNote(manager), true);
  });

  it("archive document metadata — только owner", () => {
    assert.equal(canArchiveClientDocument(manager), false);
    assert.equal(canArchiveClientDocument(owner), true);
    assert.equal(canCreateClientDocument(manager), true);
    assert.equal(canUpdateClientDocument(manager), true);
  });
});

describe("client data map", () => {
  it("public document не содержит storage_path и storageProvider", () => {
    const record: ClientDocumentRecord = {
      id: "uuid-doc",
      clientId: "DEMO-1001",
      externalId: "DOC-DEMO-001",
      name: "scan.pdf",
      originalFileName: "scan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1000,
      documentType: "passport_copy",
      status: "uploaded",
      storageProvider: "demo",
      storageState: "demo",
      uploadedByName: "Daniel Cooper",
      uploadedAt: "2026-05-20T11:00:00Z",
    };
    const pub = toPublicDocument(record);
    assert.equal("storageProvider" in pub, false);
    assert.equal("storagePath" in pub, false);
    assert.equal("storageBucket" in pub, false);

    const ui = mapDocumentPublicToClientDocument(pub);
    assert.equal(ui.name, "scan.pdf");
    assert.equal(ui.documentType, "passport_copy");
    assert.equal("storagePath" in ui, false);
  });

  it("mapNoteRecordToClientNote сохраняет поля UI", () => {
    const note = mapNoteRecordToClientNote({
      id: "NT-DEMO-1",
      clientId: "DEMO-1001",
      author: "Daniel Cooper",
      text: "Hello",
      createdAt: "2026-05-27T10:00:00Z",
    });
    assert.equal(note.text, "Hello");
    assert.equal(note.author, "Daniel Cooper");
  });
});

describe("migration 023_client_notes_documents.sql", () => {
  it("расширяет client_notes и создаёт client_documents без destructive SQL", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/023_client_notes_documents.sql"),
      "utf8",
    );
    assert.match(sql, /client_uuid uuid/i);
    assert.match(sql, /client_notes_client_uuid_fkey/i);
    assert.match(sql, /create table if not exists client_documents/i);
    assert.match(sql, /backfill/i);
    assert.doesNotMatch(sql, /drop table/i);
    assert.doesNotMatch(sql, /truncate/i);
    assert.doesNotMatch(sql, /alter table client_notes drop/i);
  });

  it("документирует legacy client_notes.id как text (gap)", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/023_client_notes_documents.sql"),
      "utf8",
    );
    assert.doesNotMatch(sql, /alter table client_notes[\s\S]*alter column id type uuid/i);
  });
});

describe("demo seed notes and documents", () => {
  const seedPaths = {
    sqlEditor: path.join(process.cwd(), "SPIORA_DEMO_SEED.sql"),
    supabase: path.join(process.cwd(), "supabase/seeds/clients-demo.sql"),
  };

  function countMatches(sql: string, pattern: RegExp): number {
    return [...sql.matchAll(pattern)].length;
  }

  it("seed содержит 10 demo-заметок и 16 document metadata", () => {
    for (const filePath of Object.values(seedPaths)) {
      const sql = readFileSync(filePath, "utf8");
      assert.equal(countMatches(sql, /'NT-DEMO-\d+'/g), 10, filePath);
      assert.equal(countMatches(sql, /'DOC-DEMO-\d+'/g), 16, filePath);
      assert.match(sql, /on conflict \(id\) do nothing/i);
      assert.match(sql, /on conflict \(external_id\) do nothing/i);
    }
  });

  it("SPIORA_DEMO_SEED.sql и clients-demo.sql совпадают по notes/documents блокам", () => {
    const editor = readFileSync(seedPaths.sqlEditor, "utf8");
    const supabase = readFileSync(seedPaths.supabase, "utf8");
    const noteBlock = (s: string) => {
      const start = s.indexOf("insert into client_notes");
      const end = s.indexOf("insert into client_documents", start);
      assert.ok(start >= 0 && end > start);
      return s.slice(start, end).trim();
    };
    const docBlock = (s: string) => {
      const start = s.indexOf("insert into client_documents");
      const marker = "on conflict (external_id) do nothing;";
      const end = s.indexOf(marker, start);
      assert.ok(start >= 0 && end > start);
      return s.slice(start, end + marker.length).trim();
    };
    assert.equal(noteBlock(editor), noteBlock(supabase));
    assert.equal(docBlock(editor), docBlock(supabase));
  });

  it("seed использует fictional paths и machine keys", () => {
    for (const filePath of Object.values(seedPaths)) {
      const sql = readFileSync(filePath, "utf8");
      assert.match(sql, /passport_copy/);
      assert.match(sql, /under_review/);
      assert.match(sql, /demo\/clients\/DEMO-/);
      assert.doesNotMatch(sql, /signedUrl/i);
    }
  });
});

describe("AI client context sanitization", () => {
  it("включает summaries notes и document metadata без storage path", () => {
    const context = buildClientAiContext({
      client: {
        id: "DEMO-1001",
        name: "John Carter",
        phone: "+0001",
        email: "john@example.com",
        status: "In progress",
        manager: "Daniel Cooper",
        source: "demo",
        rowIndex: 1,
      },
      surveys: [],
      documents: [
        {
          id: "internal-uuid",
          clientId: "DEMO-1001",
          name: "passport.pdf",
          uploadedAt: "2026-05-20",
          category: "passport_copy",
          documentType: "passport_copy",
          status: "approved",
        },
      ],
      notes: [
        {
          id: "NT-DEMO-1",
          clientId: "DEMO-1001",
          author: "Daniel",
          text: "Short note",
          createdAt: "2026-05-27",
        },
      ],
      source: "postgresql",
    });

    assert.match(context, /passport\.pdf/);
    assert.match(context, /passport_copy/);
    assert.match(context, /approved/);
    assert.match(context, /Short note/);
    assert.doesNotMatch(context, /internal-uuid/);
    assert.doesNotMatch(context, /storage_path/);
    assert.doesNotMatch(context, /demo\/clients/);
  });
});

describe("postgres primary — no silent fallback for client data", () => {
  it("legacy fallback для notes/documents не включён по умолчанию", () => {
    assert.equal(isCrmLegacyFallbackAllowed({}), false);
  });

  it("client-notes-repo и client-documents-repo помечены server-only", () => {
    for (const file of ["client-notes-repo.ts", "client-documents-repo.ts"]) {
      const source = readFileSync(
        path.join(process.cwd(), "src/lib/supabase", file),
        "utf8",
      );
      assert.match(source, /import "server-only"/);
    }
  });
});
