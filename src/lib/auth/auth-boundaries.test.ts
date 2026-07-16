import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("auth client boundaries", () => {
  it("browser client does not reference service role", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/browser.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /SERVICE_ROLE/i);
    assert.match(source, /ANON_KEY|PUBLISHABLE_KEY/);
  });

  it("server-auth client uses anon key only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/server-auth.ts"),
      "utf8",
    );
    assert.doesNotMatch(source, /SERVICE_ROLE/i);
    assert.match(source, /server-only/);
  });

  it("admin client stays server-only", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/supabase/server.ts"),
      "utf8",
    );
    assert.match(source, /server-only/);
    assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("login action has no silent supabase→legacy fallback", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/login/actions.ts"),
      "utf8",
    );
    assert.match(source, /No silent fallback/);
    assert.match(source, /signInWithSupabasePassword/);
    assert.match(source, /isLegacyAuthAllowed/);
  });
});
