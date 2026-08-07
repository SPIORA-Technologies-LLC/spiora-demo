import { NextResponse } from "next/server";
import { requireClientForMfa, requestMeta } from "@/lib/client-portal/mfa-api";
import { recoverClientMfaWithCode } from "@/lib/client-portal/mfa-recovery";
import { checkPasswordFlowRateLimit } from "@/lib/auth/password-rate-limit";

export const dynamic = "force-dynamic";

/**
 * Recovery-at-login: consume code → admin delete factors → revoke sessions → login.
 * Does NOT grant AAL2.
 */
export async function POST(request: Request) {
  const gate = await requireClientForMfa();
  if (!gate.ok) return gate.response;

  const { ip, userAgent } = requestMeta(request);
  const rate = await checkPasswordFlowRateLimit(
    "client-mfa-recovery",
    gate.session.authUserId,
    ip,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const code = String(body.code ?? "").trim();
  if (!code) {
    return NextResponse.json(
      { error: { code: "INVALID_BODY" } },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await recoverClientMfaWithCode({
    authUserId: gate.session.authUserId,
    code,
    ip,
    userAgent,
  });

  if (!result.ok) {
    const status = result.code === "invalid_code" ? 401 : 400;
    return NextResponse.json(
      { error: { code: result.code.toUpperCase() } },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { redirectTo: "/client/login?mfa_reenroll=1" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
