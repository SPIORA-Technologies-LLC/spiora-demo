import "server-only";

import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-portal/session";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { mfaDisabledResponse, requestMeta } from "@/lib/auth/mfa-api";

export { requestMeta, mfaDisabledResponse };

export async function requireClientForMfa(): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getClientSession>>> }
  | { ok: false; response: NextResponse }
> {
  if (!isClientMfaEnabled()) {
    return { ok: false, response: mfaDisabledResponse() };
  }
  const session = await getClientSession();
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
