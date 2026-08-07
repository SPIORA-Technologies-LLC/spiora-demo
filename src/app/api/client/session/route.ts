import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { getClientMfaAssurance } from "@/lib/client-portal/mfa-service";
import { needsMfaChallenge } from "@/lib/auth/mfa-aal";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);

  let challengeRequired = false;
  if (isClientMfaEnabled()) {
    const aal = await getClientMfaAssurance();
    challengeRequired = needsMfaChallenge(aal);
  }

  return clientApiOk({
    session: {
      id: session.id,
      email: session.email,
      firstName: session.firstName,
      preferredLocale: session.preferredLocale,
      mfaReenrollRequired: session.mfaReenrollRequired,
    },
    mfa: {
      enabled: isClientMfaEnabled(),
      challengeRequired,
    },
  });
}
