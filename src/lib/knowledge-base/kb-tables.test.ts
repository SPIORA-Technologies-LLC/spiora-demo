import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  documentToCsv,
  parseClipboardTsv,
  parseCsvText,
  csvMatrixToDocument,
} from "./table-csv.ts";
import { validateKbTableDocument } from "./table-document.ts";
import {
  emptyKbTableDocument,
  escapeCsvFormula,
  isSafeHttpUrl,
  MAX_KB_TABLE_CELLS,
} from "./table-limits.ts";
import { shouldEnsureDraftForUpload } from "./kb-auto-draft.ts";

describe("KB table document validation", () => {
  it("create empty table document", () => {
    const doc = emptyKbTableDocument(3, 2);
    const result = validateKbTableDocument(doc);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.columns.length, 3);
    assert.equal(result.data.rows.length, 2);
  });

  it("edit cell keeps stable column ids", () => {
    const doc = emptyKbTableDocument(1, 1);
    const colId = doc.columns[0]!.id;
    doc.columns[0]!.name = "Renamed";
    doc.rows[0]!.cells[colId] = "Acme";
    const result = validateKbTableDocument(doc);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.columns[0]!.id, colId);
    assert.equal(result.data.columns[0]!.name, "Renamed");
    assert.equal(result.data.rows[0]!.cells[colId], "Acme");
  });

  it("rejects unknown column refs and unsafe urls", () => {
    const doc = emptyKbTableDocument(1, 1);
    const bad = {
      columns: doc.columns,
      rows: [{ id: "r1", cells: { nope: "x" } }],
    };
    assert.equal(validateKbTableDocument(bad).ok, false);

    doc.columns[0]!.type = "url";
    doc.rows[0]!.cells[doc.columns[0]!.id] = "javascript:alert(1)";
    assert.equal(validateKbTableDocument(doc).ok, false);
  });

  it("rejects prototype pollution keys", () => {
    const doc = emptyKbTableDocument(1, 1);
    const cells: Record<string, unknown> = { [doc.columns[0]!.id]: "ok" };
    cells.__proto__ = { polluted: true };
    const polluted = {
      columns: doc.columns,
      rows: [{ id: "r1", cells }],
    };
    assert.equal(validateKbTableDocument(polluted).ok, false);
  });

  it("rejects oversized description", async () => {
    const { validateKbTableDescription } = await import("./table-document.ts");
    assert.equal(validateKbTableDescription("ok").ok, true);
    assert.equal(validateKbTableDescription("x".repeat(2001)).ok, false);
  });
});

describe("KB table CSV", () => {
  it("imports comma and semicolon CSV", () => {
    const comma = parseCsvText("Name,Age\nAda,36\n");
    assert.equal(comma.ok, true);
    if (!comma.ok) return;
    const doc = csvMatrixToDocument(comma.data.matrix, { headerRow: true });
    assert.equal(doc.ok, true);

    const semi = parseCsvText("Name;Age\nAda;36\n");
    assert.equal(semi.ok, true);
    if (!semi.ok) return;
    assert.equal(semi.data.delimiter, ";");
  });

  it("parses quoted multiline cells", () => {
    const raw = `Title,Note\n"Hello","Line1\nLine2"\n`;
    const parsed = parseCsvText(raw);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.data.matrix[1]![1], "Line1\nLine2");
  });

  it("escapes CSV formula injection on export", () => {
    assert.equal(escapeCsvFormula("=cmd"), "'=cmd");
    assert.equal(escapeCsvFormula("+1"), "'+1");
    assert.equal(escapeCsvFormula("\t=cmd"), "'\t=cmd");
    assert.equal(escapeCsvFormula(" =1+1"), "' =1+1");
    assert.equal(escapeCsvFormula("safe"), "safe");
    const doc = emptyKbTableDocument(1, 1);
    doc.rows[0]!.cells[doc.columns[0]!.id] = "=1+1";
    const csv = documentToCsv(doc);
    assert.match(csv, /'=1\+1/);
  });

  it("rejects oversized CSV text", () => {
    const huge = "a".repeat(5 * 1024 * 1024 + 1);
    assert.equal(parseCsvText(huge).ok, false);
  });

  it("rejects oversized cell matrix via clipboard limits", () => {
    const huge = Array.from({ length: 51 }, () => "a").join("\t");
    const parsed = parseClipboardTsv(huge);
    assert.equal(parsed.ok, false);
  });

  it("enforces 50k cells constant", () => {
    assert.equal(MAX_KB_TABLE_CELLS, 50_000);
  });
});

describe("KB table security helpers", () => {
  it("blocks unsafe URLs and allows https", () => {
    assert.equal(isSafeHttpUrl("https://example.com"), true);
    assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
    assert.equal(isSafeHttpUrl("data:text/html,hi"), false);
  });

  it("XSS stays plain text in document values", () => {
    const doc = emptyKbTableDocument(1, 1);
    doc.rows[0]!.cells[doc.columns[0]!.id] = "<script>alert(1)</script>";
    const result = validateKbTableDocument(doc);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.data.rows[0]!.cells[doc.columns[0]!.id],
      "<script>alert(1)</script>",
    );
  });

  it("cancelled upload / no files does not ensure draft", () => {
    assert.equal(shouldEnsureDraftForUpload(0), false);
  });
});

describe("KB table policy shape", () => {
  it("migration 028 defines table, RLS, hard-delete, revision", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/028_knowledge_base_tables.sql"),
      "utf8",
    );
    assert.match(sql, /knowledge_base_tables/);
    assert.match(sql, /revision/);
    assert.match(sql, /rls_kb_tables_select_published/);
    assert.match(sql, /spiora_block_hard_delete/);
    assert.match(sql, /row_count <= 1000/);
    assert.match(sql, /description is null or length\(description\) <= 2000/);
  });

  it("API routes exist for CRUD import export archive", () => {
    const base = join(process.cwd(), "src/app/api/knowledge-base/[slug]/tables");
    assert.ok(readFileSync(join(base, "route.ts"), "utf8").includes("POST"));
    assert.ok(
      readFileSync(join(base, "[tableId]/route.ts"), "utf8").includes("expectedRevision"),
    );
    assert.ok(
      readFileSync(join(base, "[tableId]/archive/route.ts"), "utf8").includes("POST"),
    );
    assert.ok(
      readFileSync(join(base, "import-csv/route.ts"), "utf8").includes("parseCsvText"),
    );
    assert.ok(
      readFileSync(join(base, "[tableId]/export.csv/route.ts"), "utf8").includes(
        "documentToCsv",
      ),
    );
  });
});
