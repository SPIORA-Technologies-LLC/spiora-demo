import { NextResponse } from "next/server";
import { requireClientForMfa } from "@/lib/client-portal/mfa-api";
import { getClientMfaStatus } from "@/lib/client-portal/mfa-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireClientForMfa();
  if (!gate.ok) return gate.response;

  const status = await getClientMfaStatus({
    authUserId: gate.session.authUserId,
    mfaReenrollRequired: gate.session.mfaReenrollRequired,
  });

  return NextResponse.json(
    {
      enabled: status.enabled,
      challengeRequired: status.challengeRequired,
      verifiedTotpCount: status.verifiedTotpCount,
      pendingTotpCount: status.pendingTotpCount,
      verifiedFactorId: status.verifiedFactorId,
      unusedRecoveryCodes: status.unusedRecoveryCodes,
      mfaReenrollRequired: status.mfaReenrollRequired,
      aal: status.aal,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
