import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const PREFLIGHT = path.join(
  process.cwd(),
  "SPIORA_FINANCE_PREFLIGHT_036.sql",
);

/**
 * Strip dollar-quoted dynamic SQL bodies (EXECUTE $tag$ ... $tag$)
 * so remaining text must not statically reference missing finance relations.
 */
function stripDollarQuoted(sql: string): string {
  return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "/* dynamic */");
}

describe("SPIORA_FINANCE_PREFLIGHT_036 parse-safety", () => {
  const raw = readFileSync(PREFLIGHT, "utf8");
  const staticSql = stripDollarQuoted(raw);

  it("documents parse-time hazard and uses temp plpgsql runner", () => {
    assert.match(raw, /never statically reference finance tables/i);
    assert.match(raw, /pg_temp\.spiora_finance_preflight_036/);
    assert.match(raw, /execute/i);
  });

  it("does not statically FROM/JOIN finance tables outside EXECUTE strings", () => {
    assert.doesNotMatch(
      staticSql,
      /\b(from|join)\s+public\.client_finance_(profiles|payments|contract_changes)\b/i,
    );
  });

  it("does not use CASE/to_regclass else EXISTS FROM finance table antipattern in static SQL", () => {
    assert.doesNotMatch(
      staticSql,
      /to_regclass\([^\)]*client_finance[\s\S]{0,120}exists\s*\(\s*select[\s\S]{0,80}from\s+public\.client_finance/i,
    );
  });

  it("counts finance tables via to_regclass / catalog, not static FROM", () => {
    assert.match(raw, /to_regclass/);
    assert.match(raw, /information_schema|pg_proc|pg_catalog/i);
  });
});
