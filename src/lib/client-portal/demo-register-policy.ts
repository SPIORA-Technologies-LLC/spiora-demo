import { normalizeInviteEmail } from "./invite-token";

const MIN_PASSWORD_LEN = 8;

export type DemoRegisterBody = {
  email: string;
  password: string;
};

export function parseDemoRegisterBody(
  body: Record<string, unknown>,
): DemoRegisterBody | null {
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return null;
  return { email, password };
}

export function validateDemoRegisterCredentials(
  input: DemoRegisterBody,
): "ok" | "INVALID_CREDENTIALS" {
  const email = normalizeInviteEmail(input.email);
  if (!email) return "INVALID_CREDENTIALS";
  if (input.password.length < MIN_PASSWORD_LEN) {
    return "INVALID_CREDENTIALS";
  }
  return "ok";
}

export function mapDemoRegisterResultToHttp(result: {
  ok: boolean;
  code?: string;
}): { status: number; body: { ok?: true; error?: { code: string } } } {
  if (result.ok) {
    return { status: 200, body: { ok: true } };
  }

  const code = result.code ?? "INTERNAL";
  if (code === "DEMO_AUTH_DISABLED") {
    return { status: 403, body: { error: { code: "FORBIDDEN" } } };
  }
  if (code === "INVALID_CREDENTIALS") {
    return { status: 400, body: { error: { code: "INVALID_BODY" } } };
  }
  return { status: 400, body: { error: { code: "INTERNAL" } } };
}

export function isDemoRegisterSuccessBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { ok?: unknown }).ok === true &&
    Object.keys(body as object).length === 1
  );
}

export function demoRegisterResponseMayLeakSensitiveFields(
  bodyText: string,
): boolean {
  const lower = bodyText.toLowerCase();
  return (
    lower.includes("service") ||
    lower.includes("password") ||
    lower.includes("supabase")
  );
}
