import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { validateKbSeedSql } from "../../../scripts/validate-kb-seed-026.mjs";

const SEED_PATH = path.join(process.cwd(), "SPIORA_KNOWLEDGE_BASE_SEED_026.sql");

describe("Knowledge Base seed SQL safety", () => {
  it("rejects bare schema.demo outside strings (relation demo hazard)", () => {
    const bad = `
insert into t values ('ok');
select * from spiora.demo;
`;
    const errors = validateKbSeedSql(bad);
    assert.ok(errors.some((e) => /bare spiora\.demo|relation "demo"/i.test(e)));
  });

  it("rejects @spiora.demo email TLD", () => {
    const bad = `insert into t values ($kb$olivia@spiora.demo$kb$);`;
    const errors = validateKbSeedSql(bad);
    assert.ok(errors.some((e) => /hazardous email TLD/i.test(e)));
  });

  it("accepts current SPIORA_KNOWLEDGE_BASE_SEED_026.sql", () => {
    const sql = readFileSync(SEED_PATH, "utf8");
    const errors = validateKbSeedSql(sql);
    assert.deepEqual(errors, []);
    assert.match(sql, /\$kb_/);
    assert.doesNotMatch(sql, /@spiora\.demo/i);
    assert.match(sql, /on conflict \(slug\) do update/i);
  });
});
