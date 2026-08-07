/** Pages allowed while employee has verified MFA but session is still AAL1. */
const MFA_GATE_PATH_PREFIXES = ["/mfa"];

/** Client portal MFA challenge/recovery (AAL1 allowed). */
const CLIENT_MFA_GATE_PATH_PREFIXES = ["/client/mfa"];

/** API routes allowed without AAL2 when MFA challenge is required. */
const MFA_EXEMPT_API_PREFIXES = [
  "/api/auth/mfa",
  "/api/locale",
  "/api/webhooks",
];

/** Client APIs allowed while client MFA challenge is required. */
const CLIENT_MFA_EXEMPT_API_PREFIXES = [
  "/api/client/auth/mfa",
  "/api/client/auth/password/forgot",
  "/api/client/auth/password/reset",
  "/api/client/auth/oauth/google",
  "/api/client/auth/config",
  "/api/client/auth/demo-register",
  "/api/client/invite",
  "/api/client/logout",
  "/api/client/session",
];

export function isMfaGatePath(pathname: string): boolean {
  return MFA_GATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isClientMfaGatePath(pathname: string): boolean {
  return CLIENT_MFA_GATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMfaExemptApiPath(pathname: string): boolean {
  if (MFA_EXEMPT_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )) {
    return true;
  }
  // Client-plane and public auth starts must never hit employee AAL2 gate.
  if (pathname.startsWith("/api/client/")) return true;
  if (pathname === "/api/auth/oauth/google") return true;
  if (pathname === "/api/auth/password/forgot") return true;
  if (pathname === "/api/auth/password/reset") return true;
  return false;
}

export function isClientMfaExemptApiPath(pathname: string): boolean {
  return CLIENT_MFA_EXEMPT_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isClientApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/client/");
}

export function isEmployeeApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") && !pathname.startsWith("/api/client/");
}
