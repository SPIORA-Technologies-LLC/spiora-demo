import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "./types";
import { isUserRole } from "./users";

export const COOKIE_NAME = "spiora_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEV_FALLBACK_SECRET = "spiora-demo-dev-secret-change-me";

export type AuthSecretSource = "env" | "dev-fallback" | "missing";

export function getAuthSecretState(env: NodeJS.ProcessEnv = process.env): {
  secret: Uint8Array | null;
  source: AuthSecretSource;
} {
  const secret = env.AUTH_SECRET?.trim();
  if (secret) {
    return {
      secret: new TextEncoder().encode(secret),
      source: "env",
    };
  }
  if (env.NODE_ENV !== "production") {
    return {
      secret: new TextEncoder().encode(DEV_FALLBACK_SECRET),
      source: "dev-fallback",
    };
  }
  return { secret: null, source: "missing" };
}

export function getSessionCookieConfig(
  env: NodeJS.ProcessEnv = process.env,
): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const { secret } = getAuthSecretState();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<SessionUser | null> {
  const { secret } = getAuthSecretState(env);
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const id = typeof payload.id === "string" ? payload.id : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const name = typeof payload.name === "string" ? payload.name : null;
    const role = typeof payload.role === "string" ? payload.role : null;

    if (!id || !email || !name || !role || !isUserRole(role)) {
      return null;
    }

    return { id, email, name, role };
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, getSessionCookieConfig());
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function getSessionFromToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  return verifySessionToken(token);
}
