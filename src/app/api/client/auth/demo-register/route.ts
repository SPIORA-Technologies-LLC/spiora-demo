import { checkRequestOrigin } from "@/lib/auth/security";
import {
  demoRegisterConfirmedClientUser,
  isClientPortalDemoAuthEnabled,
} from "@/lib/client-portal/demo-auth";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const originHeader = request.headers.get("origin");
  const host = request.headers.get("host");
  const originCheck = checkRequestOrigin(originHeader, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return clientApiError("ORIGIN_MISMATCH", 403);
  }

  if (!isClientPortalDemoAuthEnabled()) {
    return clientApiError("FORBIDDEN", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return clientApiError("INVALID_BODY", 400);
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = typeof body.firstName === "string" ? body.firstName : null;

  const result = await demoRegisterConfirmedClientUser({ email, password, firstName });
  if (!result.ok) {
    const map: Record<string, Parameters<typeof clientApiError>[0]> = {
      DEMO_AUTH_DISABLED: "FORBIDDEN",
      INVALID_CREDENTIALS: "INVALID_BODY",
      REGISTRATION_FAILED: "INTERNAL",
    };
    const code = map[result.code] ?? "INTERNAL";
    const status = result.code === "DEMO_AUTH_DISABLED" ? 403 : 400;
    return clientApiError(code, status);
  }

  return clientApiOk({ ok: true });
}
