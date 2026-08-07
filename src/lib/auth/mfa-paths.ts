/** Pages allowed while employee has verified MFA but session is still AAL1. */
const MFA_GATE_PATH_PREFIXES = ["/mfa"];

/** API routes allowed without AAL2 when MFA challenge is required. */
const MFA_EXEMPT_API_PREFIXES = [
  "/api/auth/mfa",
  "/api/locale",
  "/api/webhooks",
];

export function isMfaGatePath(pathname: string): boolean {
  return MFA_GATE_PATH_PREFIXES.some(
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

export function isEmployeeApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") && !pathname.startsWith("/api/client/");
}
