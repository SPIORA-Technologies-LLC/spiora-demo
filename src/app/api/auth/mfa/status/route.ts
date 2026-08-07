import { NextResponse } from "next/server";
import { requireEmployeeForMfa } from "@/lib/auth/mfa-api";
import { getEmployeeMfaStatus } from "@/lib/auth/mfa-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireEmployeeForMfa();
  if (!gate.ok) return gate.response;

  const status = await getEmployeeMfaStatus({
    authUserId: gate.session.authUserId!,
    mfaReenrollRequired: gate.session.mfaReenrollRequired,
  });

  return NextResponse.json(
    {
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
