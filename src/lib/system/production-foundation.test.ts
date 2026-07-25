import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function scanTsxForPattern(relativeDir: string, pattern: RegExp): string[] {
  const offenders: string[] = [];
  const stack = [path.join(process.cwd(), relativeDir)];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const name of readdirSync(current)) {
      const target = path.join(current, name);
      if (statSync(target).isDirectory()) {
        stack.push(target);
        continue;
      }
      if (!name.endsWith(".tsx")) continue;
      const content = readFileSync(target, "utf8");
      if (pattern.test(content)) {
        offenders.push(path.relative(process.cwd(), target));
      }
    }
  }

  return offenders;
}

describe("PR #14 — production foundation", () => {
  it("getSupabaseAdmin помечен server-only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/server.ts"),
      "utf8",
    );
    assert.match(source, /import "server-only"/);
    assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE_SERVICE/);
  });

  it("clients-repo и system-health — server-only", () => {
    for (const file of [
      "src/lib/supabase/clients-repo.ts",
      "src/lib/system/system-health.ts",
      "src/lib/dashboard/company-health.ts",
    ]) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      assert.match(source, /import "server-only"/, file);
    }
  });

  it("React components не импортируют *-repo.ts", () => {
    const repoImport =
      /@\/lib\/supabase\/[\w-]+-repo|getSupabaseAdmin|from "@\/lib\/clients\/store"/;
    const offenders = [
      ...scanTsxForPattern("src/components", repoImport),
      ...scanTsxForPattern("src/app", repoImport),
    ];
    assert.deepEqual(offenders, []);
  });

  it("Health API route — owner-only, без секретов в ответе", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/system/health/route.ts"),
      "utf8",
    );
    assert.match(source, /session\.role !== "owner"/);
    assert.match(source, /getSystemHealth/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("Dashboard page подключает live company health", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/(app)/dashboard/page.tsx"),
      "utf8",
    );
    assert.match(source, /getCompanyHealthMetrics/);
    assert.match(source, /health={health}/);
    assert.doesNotMatch(source, /COMPANY_HEALTH/);
  });

  it("SPIORA seed-файлы остаются согласованными", () => {
    const editor = readFileSync(
      path.join(process.cwd(), "SPIORA_DEMO_SEED.sql"),
      "utf8",
    );
    const supabase = readFileSync(
      path.join(process.cwd(), "supabase/seeds/clients-demo.sql"),
      "utf8",
    );

    assert.match(editor, /delete from clients/i);
    assert.match(supabase, /delete from clients/i);
    assert.doesNotMatch(editor, /insert into clients/i);
    assert.doesNotMatch(supabase, /insert into clients/i);
    assert.doesNotMatch(editor, /\('DEMO-\d{4}'/);
    assert.doesNotMatch(supabase, /\('DEMO-\d{4}'/);
  });
});
