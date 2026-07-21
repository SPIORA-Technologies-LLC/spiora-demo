import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildClientInvitePath,
  buildClientInviteUrl,
  computeInvitationState,
  generateClientInviteToken,
  hashClientInviteToken,
  maskEmail,
  normalizeInviteEmail,
  verifyClientInviteToken,
  assertInvitationDtoHasNoTokenHash,
  CLIENT_INVITE_TOKEN_BYTES,
} from "./invite-token.ts";
import {
  canEmployeeAssignTo,
  isAssigneeIdInPool,
} from "./assignee-context.ts";

const root = path.resolve(process.cwd());

describe("client invite tokens", () => {
  it("generates high-entropy URL-safe tokens", () => {
    const a = generateClientInviteToken();
    const b = generateClientInviteToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= Math.ceil((CLIENT_INVITE_TOKEN_BYTES * 8) / 6) - 2);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });

  it("stores hash only — plaintext never equals hash", () => {
    const token = generateClientInviteToken();
    const hash = hashClientInviteToken(token);
    assert.equal(hash.length, 64);
    assert.notEqual(token, hash);
    assert.ok(verifyClientInviteToken(token, hash));
    assert.equal(verifyClientInviteToken("wrong", hash), false);
  });

  it("does not put email or ids in invite path", () => {
    const token = generateClientInviteToken();
    const pathUrl = buildClientInvitePath(token);
    assert.equal(pathUrl.startsWith("/client/invite/"), true);
    assert.equal(pathUrl.includes("@"), false);
    assert.equal(
      buildClientInviteUrl(token, "https://demo.spiora.app").includes("@"),
      false,
    );
  });

  it("computes invitation state from fields", () => {
    const base = {
      acceptedAt: null as string | null,
      revokedAt: null as string | null,
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    assert.equal(computeInvitationState(base), "pending");
    assert.equal(
      computeInvitationState({
        ...base,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
      "expired",
    );
    assert.equal(
      computeInvitationState({ ...base, revokedAt: new Date().toISOString() }),
      "revoked",
    );
    assert.equal(
      computeInvitationState({ ...base, acceptedAt: new Date().toISOString() }),
      "accepted",
    );
  });

  it("masks email for public preview", () => {
    assert.equal(maskEmail("client@example.com"), "c***@example.com");
    assert.equal(normalizeInviteEmail("  A@B.COM "), "a@b.com");
    assert.equal(normalizeInviteEmail("not-an-email"), null);
  });
});

describe("invitation public DTO safety", () => {
  it("rejects DTO payloads that contain token hash keys", () => {
    assert.throws(() =>
      assertInvitationDtoHasNoTokenHash({
        id: "x",
        email: "a@b.c",
        state: "pending",
        tokenHash: "abc",
      }),
    );
  });
});

describe("migration 032 policy shape", () => {
  const sql = readFileSync(
    path.join(root, "supabase/migrations/032_spiora_client_invitations.sql"),
    "utf8",
  );

  it("stores token_hash and never documents plaintext storage", () => {
    assert.match(sql, /token_hash text not null/);
    assert.match(sql, /Store token_hash only/i);
    assert.doesNotMatch(sql, /token text not null unique/);
  });

  it("enables RLS and revokes delete", () => {
    assert.match(sql, /enable row level security/);
    assert.match(sql, /revoke delete on table public\.client_invitations/);
    assert.match(sql, /spiora_block_hard_delete/);
  });

  it("creates client_portal_users identity table", () => {
    assert.match(sql, /create table if not exists public\.client_portal_users/);
    assert.match(sql, /invitation_id uuid not null unique/);
  });

  it("does not add organization_id column in phase 1", () => {
    assert.doesNotMatch(sql, /organization_id\s+uuid/i);
  });
});

describe("client portal demo auth", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("demo skip email confirm only when SPIORA_DEMO_MODE and supabase configured", async () => {
    const { isClientPortalDemoAuthEnabledFromEnv } = await import(
      "./demo-auth-policy.ts"
    );
    delete process.env.SPIORA_DEMO_MODE;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    assert.equal(isClientPortalDemoAuthEnabledFromEnv(process.env), false);

    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_ENABLE_SUPABASE = "true";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    assert.equal(isClientPortalDemoAuthEnabledFromEnv(process.env), true);

    process.env.SPIORA_DEMO_MODE = "false";
    assert.equal(isClientPortalDemoAuthEnabledFromEnv(process.env), false);
  });

  it("demo-register route gates on server before registration", () => {
    const route = readFileSync(
      path.join(root, "src/app/api/client/auth/demo-register/route.ts"),
      "utf8",
    );
    assert.match(route, /if \(!isClientPortalDemoAuthEnabled\(\)\)/);
    assert.match(route, /clientApiError\("FORBIDDEN", 403\)/);
    const gateIndex = route.indexOf('if (!isClientPortalDemoAuthEnabled())');
    const registerIndex = route.indexOf(
      "await demoRegisterConfirmedClientUser",
    );
    assert.ok(gateIndex >= 0 && registerIndex > gateIndex);
  });

  it("demo-register success response exposes only ok flag", () => {
    const route = readFileSync(
      path.join(root, "src/app/api/client/auth/demo-register/route.ts"),
      "utf8",
    );
    assert.match(route, /return clientApiOk\(\{ ok: true \}\)/);
    assert.doesNotMatch(route, /console\.(log|error|warn|debug)/);
    assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(route, /service.?role/i);
  });

  it("demo-auth module does not log credentials or return supabase user payloads", () => {
    const file = readFileSync(
      path.join(root, "src/lib/client-portal/demo-auth.ts"),
      "utf8",
    );
    assert.doesNotMatch(file, /console\.(log|error|warn|debug)/);
    assert.match(file, /return \{ ok: true \}/);
    assert.match(file, /return \{ ok: false, code:/);
    assert.doesNotMatch(file, /return \{[^}]*createError/);
    assert.doesNotMatch(file, /return \{[^}]*listError/);
    assert.doesNotMatch(file, /return \{[^}]*updateError/);
    assert.doesNotMatch(file, /return \{[^}]*existing/);
  });
});

describe("invitation assignee employee context", () => {
  const pool = [
    { id: "owner-1", name: "Owner", role: "owner" as const },
    { id: "manager-1", name: "Manager", role: "manager" as const },
  ];

  it("rejects arbitrary UUID not in assignable pool", () => {
    assert.equal(
      isAssigneeIdInPool("00000000-0000-4000-8000-000000000099", pool),
      false,
    );
    assert.equal(
      canEmployeeAssignTo(
        "00000000-0000-4000-8000-000000000099",
        { employeeId: "owner-1", employeeRole: "owner" },
        pool,
      ),
      false,
    );
  });

  it("requires employee to belong to assignable pool", () => {
    assert.equal(
      canEmployeeAssignTo(
        "manager-1",
        { employeeId: "forged-session", employeeRole: "owner" },
        pool,
      ),
      false,
    );
  });

  it("allows owner to assign another assignable member", () => {
    assert.equal(
      canEmployeeAssignTo(
        "manager-1",
        { employeeId: "owner-1", employeeRole: "owner" },
        pool,
      ),
      true,
    );
  });

  it("create invitation validates assignee with employee context", () => {
    const service = readFileSync(
      path.join(root, "src/lib/client-portal/invitation-service.ts"),
      "utf8",
    );
    assert.match(service, /employeeRole: input\.employeeRole/);
    assert.match(service, /assignees\.validate\(assignedTo/);
  });
});

describe("demo auth policy (framework-agnostic)", () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("maps demo register access to forbidden when demo mode off", async () => {
    const { evaluateDemoRegisterAccess } = await import("./demo-auth-policy.ts");
    process.env.SPIORA_DEMO_MODE = "false";
    assert.equal(evaluateDemoRegisterAccess(process.env), "forbidden");
  });

  it("demo register success body stays minimal", async () => {
    const { isDemoRegisterSuccessBody } = await import(
      "./demo-register-policy.ts"
    );
    assert.equal(isDemoRegisterSuccessBody({ ok: true }), true);
    assert.equal(isDemoRegisterSuccessBody({ ok: true, password: "x" }), false);
  });
});

describe("employee / client route guard separation (source)", () => {
  it("middleware blocks employee session from /client shell", () => {
    const mw = readFileSync(path.join(root, "middleware.ts"), "utf8");
    assert.match(mw, /Employee sessions cannot enter the client portal shell/);
    assert.match(mw, /\/client/);
    assert.match(mw, /PROTECTED_PREFIXES/);
  });

  it("employee app layout still requires getSession", () => {
    const layout = readFileSync(
      path.join(root, "src/app/(app)/layout.tsx"),
      "utf8",
    );
    assert.match(layout, /getSession/);
    assert.doesNotMatch(layout, /getClientSession/);
  });

  it("client portal layout requires getClientSession", () => {
    const layout = readFileSync(
      path.join(root, "src/app/client/(portal)/layout.tsx"),
      "utf8",
    );
    assert.match(layout, /getClientSession/);
    assert.doesNotMatch(layout, /getSession\(\)/);
  });

  it("resolveSessionFromAuthUserId only maps user_profiles employee roles", () => {
    const file = readFileSync(
      path.join(root, "src/lib/auth/middleware-session.ts"),
      "utf8",
    );
    assert.match(file, /user_profiles/);
    assert.match(file, /isUserRole/);
    assert.doesNotMatch(file, /client_portal_users/);
  });
});
