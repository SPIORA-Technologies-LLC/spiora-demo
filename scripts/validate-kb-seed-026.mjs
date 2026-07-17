/**
 * Validates SPIORA_KNOWLEDGE_BASE_SEED_026.sql for SQL parse hazards.
 * Detects defects like bare `schema.demo` → ERROR: relation "demo" does not exist.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SEED_PATH = path.join(ROOT, "SPIORA_KNOWLEDGE_BASE_SEED_026.sql");

function walkSql(sql, { onOutside } = {}) {
  let inStr = false;
  let dollarTag = null;

  for (let i = 0; i < sql.length; ) {
    const ch = sql[i];

    if (dollarTag) {
      const end = `$${dollarTag}$`;
      if (sql.startsWith(end, i)) {
        i += end.length;
        dollarTag = null;
        continue;
      }
      i += 1;
      continue;
    }

    if (!inStr) {
      if (ch === "-" && sql[i + 1] === "-") {
        while (i < sql.length && sql[i] !== "\n") i += 1;
        continue;
      }
      if (ch === "$") {
        const m = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)\$/);
        if (m) {
          dollarTag = m[1];
          i += m[0].length;
          continue;
        }
      }
      if (ch === "'") {
        inStr = true;
        i += 1;
        continue;
      }
      onOutside?.(ch, i, sql);
      i += 1;
      continue;
    }

    if (ch === "'" && sql[i + 1] === "'") {
      i += 2;
      continue;
    }
    if (ch === "'") {
      inStr = false;
      i += 1;
      continue;
    }
    i += 1;
  }

  return { inStr, dollarTag };
}

function lineCol(sql, index) {
  const before = sql.slice(0, index);
  const line = before.split("\n").length;
  const col = before.length - before.lastIndexOf("\n");
  return { line, col };
}

export function validateKbSeedSql(sql) {
  const errors = [];

  const { inStr, dollarTag } = walkSql(sql);
  if (inStr) errors.push("Unterminated single-quoted string");
  if (dollarTag) errors.push(`Unterminated dollar-quote $${dollarTag}$`);

  walkSql(sql, {
    onOutside(ch, i, text) {
      const m = text.slice(i).match(/^([A-Za-z_][A-Za-z0-9_]*)\.demo\b/);
      if (m) {
        const { line, col } = lineCol(text, i);
        errors.push(
          `Line ${line}:${col}: bare ${m[0]} outside string ` +
            `(Postgres: relation "demo" does not exist). ` +
            `Context: ${JSON.stringify(text.slice(Math.max(0, i - 24), i + 28))}`,
        );
      }
    },
  });

  // `.demo` email TLD is hazardous if a quote ever breaks — ban outside SQL comments
  const sqlNoLineComments = sql.replace(/--[^\n]*/g, "");
  const hazardous = [...sqlNoLineComments.matchAll(/@[A-Za-z0-9._+-]+\.demo\b/gi)];
  for (const m of hazardous) {
    // Remap index into original by scanning (comment strip shortens) — report pattern only
    errors.push(
      `hazardous email TLD ${m[0]} in executable SQL — use @spiora.example (avoids schema.demo parse)`,
    );
  }

  if (!/\$kb_/.test(sql)) {
    errors.push("Expected dollar-quoted translation fields ($kb_…$)");
  }

  if (!/on conflict \(slug\) do update/i.test(sql)) {
    errors.push("Missing ON CONFLICT (slug) DO UPDATE");
  }
  if (!/on conflict \(article_id, locale\) do update/i.test(sql)) {
    errors.push("Missing ON CONFLICT (article_id, locale) DO UPDATE");
  }

  return errors;
}

function main() {
  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Missing ${SEED_PATH}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(SEED_PATH, "utf8");
  const errors = validateKbSeedSql(sql);
  if (errors.length) {
    console.error("KB seed validation FAILED:");
    for (const e of errors) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log("KB seed validation OK");
}

const self = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(self)) {
  main();
}
