import "server-only";

import { getSession } from "@/lib/auth/session";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import { NextResponse } from "next/server";

export function mfaDisabledResponse() {
  return NextResponse.json(
    { error: { code: "MFA_DISABLED" } },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireEmployeeForMfa(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getSession>>> }
  | { ok: false; response: NextResponse }
> {
  if (!isEmployeeMfaEnabled()) {
    return { ok: false, response: mfaDisabledResponse() };
  }
  const session = await getSession();
  if (!session?.authUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED" } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { ok: true, session };
}

export function requestMeta(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}
