import { createHmac, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

export type PasswordRecoveryAudience = "employee" | "client";

export const EMPLOYEE_RECOVERY_COOKIE = "spiora_employee_pw_recovery";
export const CLIENT_RECOVERY_COOKIE = "spiora_client_pw_recovery";
export const EMPLOYEE_RECOVERY_COOKIE_PATH = "/api/auth/password/reset";
export const CLIENT_RECOVERY_COOKIE_PATH = "/api/client/auth/password/reset";
export const RECOVERY_GATE_MAX_AGE_SECONDS = 600;

const PURPOSE = "password_recovery" as const;

export type RecoveryGateClaims = {
  sub: string;
  purpose: typeof PURPOSE;
  audience: PasswordRecoveryAudience;
  jti: string;
};

function getGateSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export function recoveryCookieName(
  audience: PasswordRecoveryAudience,
): string {
  return audience === "employee"
    ? EMPLOYEE_RECOVERY_COOKIE
    : CLIENT_RECOVERY_COOKIE;
}

export function recoveryCookiePath(
  audience: PasswordRecoveryAudience,
): string {
  return audience === "employee"
    ? EMPLOYEE_RECOVERY_COOKIE_PATH
    : CLIENT_RECOVERY_COOKIE_PATH;
}

export function getRecoveryCookieOptions(audience: PasswordRecoveryAudience): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: recoveryCookiePath(audience),
    maxAge: RECOVERY_GATE_MAX_AGE_SECONDS,
  };
}

export async function createRecoveryGateToken(input: {
  authUserId: string;
  audience: PasswordRecoveryAudience;
  jti?: string;
}): Promise<string> {
  const jti = input.jti ?? randomUUID();
  return new SignJWT({
    purpose: PURPOSE,
    audience: input.audience,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.authUserId)
    .setIssuedAt()
    .setExpirationTime(`${RECOVERY_GATE_MAX_AGE_SECONDS}s`)
    .sign(getGateSecret());
}

export async function verifyRecoveryGateToken(
  token: string | undefined,
  expectedAudience: PasswordRecoveryAudience,
): Promise<RecoveryGateClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getGateSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    const purpose = payload.purpose;
    const audience = payload.audience;
    const jti = typeof payload.jti === "string" ? payload.jti : null;
    if (!sub || !jti) return null;
    if (purpose !== PURPOSE) return null;
    if (audience !== expectedAudience) return null;
    return {
      sub,
      purpose: PURPOSE,
      audience: expectedAudience,
      jti,
    };
  } catch {
    return null;
  }
}

export function applyRecoveryGateCookie(
  response: NextResponse,
  audience: PasswordRecoveryAudience,
  token: string,
): void {
  response.cookies.set(
    recoveryCookieName(audience),
    token,
    getRecoveryCookieOptions(audience),
  );
}

/** Clear with the exact same name + Path as set. */
export function clearRecoveryGateCookie(
  response: NextResponse,
  audience: PasswordRecoveryAudience,
): void {
  response.cookies.set(recoveryCookieName(audience), "", {
    ...getRecoveryCookieOptions(audience),
    maxAge: 0,
  });
}

export function hashAuditEmail(
  email: string,
  pepper = process.env.SPIORA_AUDIT_HMAC_PEPPER?.trim() ?? "",
): string | null {
  if (!pepper) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return createHmac("sha256", pepper).update(normalized, "utf8").digest("hex");
}

export function hashAuditIp(
  ip: string,
  pepper = process.env.SPIORA_AUDIT_HMAC_PEPPER?.trim() ?? "",
): string | null {
  if (!pepper || !ip.trim()) return null;
  return createHmac("sha256", pepper).update(ip.trim(), "utf8").digest("hex");
}

export function truncateClientIp(ip: string | undefined | null): string | null {
  if (!ip?.trim()) return null;
  const trimmed = ip.trim();
  if (trimmed.includes(".")) {
    const parts = trimmed.split(".");
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    return `${parts.slice(0, 3).join(":")}::/48`;
  }
  return null;
}
