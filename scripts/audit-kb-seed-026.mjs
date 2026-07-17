import fs from "node:fs";

const sql = fs.readFileSync("SPIORA_KNOWLEDGE_BASE_SEED_026.sql", "utf8");

function walk(sqlText, onOutside, onInside) {
  let inStr = false;
  let line = 1;
  let col = 1;
  for (let i = 0; i < sqlText.length; ) {
    const ch = sqlText[i];
    if (ch === "\n") {
      line += 1;
      col = 1;
      i += 1;
      continue;
    }
    if (!inStr) {
      if (ch === "-" && sqlText[i + 1] === "-") {
        while (i < sqlText.length && sqlText[i] !== "\n") i += 1;
        continue;
      }
      if (ch === "'") {
        inStr = true;
        i += 1;
        col += 1;
        continue;
      }
      onOutside?.(ch, i, line, col, sqlText);
      i += 1;
      col += 1;
    } else if (ch === "'" && sqlText[i + 1] === "'") {
      onInside?.("''", i, line, col);
      i += 2;
      col += 2;
    } else if (ch === "'") {
      inStr = false;
      i += 1;
      col += 1;
    } else {
      onInside?.(ch, i, line, col);
      i += 1;
      col += 1;
    }
  }
  return inStr;
}

const atHits = [];
walk(sql, (ch, i, line, col, text) => {
  if (ch === "@") {
    atHits.push({
      line,
      col,
      ctx: text.slice(Math.max(0, i - 20), i + 30).replace(/\n/g, "\\n"),
    });
  }
});

console.log("@ outside strings:", atHits);

// unicode quotes
for (const [name, re] of [
  ["curly-single", /[\u2018\u2019]/g],
  ["curly-double", /[\u201C\u201D]/g],
  ["prime", /[\u2032\u2033]/g],
]) {
  const m = [...sql.matchAll(re)];
  console.log(name, m.length);
}

// Simulate: if any @email with .tld appears, recommend dollar-quoting
const emails = [...sql.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)];
console.log(
  "emails found",
  emails.map((m) => ({ v: m[0], inStr: true })),
);

// Check DEMO-ID pattern outside
const demoIdOutside = [];
walk(sql, (ch, i, line, col, text) => {
  if (text.startsWith("DEMO", i) || text.startsWith("demo", i)) {
    const word = text.slice(i).match(/^[A-Za-z0-9_-]+/)?.[0];
    if (word && /^demo/i.test(word)) {
      demoIdOutside.push({ line, col, word, ctx: text.slice(i - 10, i + 20) });
    }
  }
});
console.log("demo* tokens outside strings", demoIdOutside);
