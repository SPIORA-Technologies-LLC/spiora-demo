import assert from "node:assert/strict";
import { SignJWT } from "jose";

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "runtime-validation-secret";
process.env.NODE_ENV = process.env.NODE_ENV || "test";

const { createSessionToken, verifySessionToken } = await import(
  "../src/lib/auth/session.ts"
);
const { getSystemHealth } = await import("../src/lib/system/system-health.ts");
const { canAccessPath } = await import("../src/lib/auth/permissions.ts");

const owner = {
  id: "olivia-bennett",
  email: "olivia@spiora.demo",
  name: "Olivia Bennett",
  role: "owner",
};

const manager = {
  id: "daniel-cooper",
  email: "daniel@spiora.demo",
  name: "Daniel Cooper",
  role: "manager",
};

const ownerToken = await createSessionToken(owner);
const managerToken = await createSessionToken(manager);

assert.deepEqual(await verifySessionToken(ownerToken), owner);
assert.deepEqual(await verifySessionToken(managerToken), manager);
assert.equal(await verifySessionToken(undefined), null);

const expiredToken = await new SignJWT(owner)
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt(Math.floor(Date.now() / 1000) - 20)
  .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));

assert.equal(await verifySessionToken(expiredToken), null);

assert.equal(canAccessPath("owner", "/settings"), true);
assert.equal(canAccessPath("manager", "/settings"), false);
assert.equal(canAccessPath("manager", "/analytics"), false);

const health = await getSystemHealth();
assert.equal(health.auth, "ok");
assert.equal(health.session, "warning");
assert.equal(health.rbac, "warning");

console.log(
  JSON.stringify(
    {
      ok: true,
      ownerLogin: "token verified",
      managerLogin: "token verified",
      unauthorized: "missing token -> null session",
      forbidden: "manager blocked from /settings and /analytics",
      expiredSession: "expired token -> null session",
      health,
    },
    null,
    2,
  ),
);
