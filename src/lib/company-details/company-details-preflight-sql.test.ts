import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const PREFLIGHT = path.join(
  process.cwd(),
  "SPIORA_COMPANY_DETAILS_PREFLIGHT_049.sql",
);

function stripDollarQuoted(sql: string): string {
  return sql.replace(/\$([A-Za-z_]*)\$[\s\S]*?\$\1\$/g, "/* dynamic */");
}

describe("SPIORA_COMPANY_DETAILS_PREFLIGHT_049 parse-safety", () => {
  const raw = readFileSync(PREFLIGHT, "utf8");
  const staticSql = stripDollarQuoted(raw);

  it("documents parse-time hazard and uses temp plpgsql runner", () => {
    assert.match(raw, /never statically reference company_details/i);
    assert.match(raw, /pg_temp\.spiora_company_details_preflight_049/);
    assert.match(raw, /to_regclass/);
  });

  it("does not statically FROM/JOIN company_details tables outside EXECUTE strings", () => {
    assert.doesNotMatch(
      staticSql,
      /\b(from|join)\s+public\.company_details(_changes)?\b/i,
    );
  });
});
