import { getClientSession } from "@/lib/client-portal/session";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { getClientMfaAssurance } from "@/lib/client-portal/mfa-service";
import { needsMfaChallenge } from "@/lib/auth/mfa-aal";
import { redirect } from "next/navigation";
import { ClientPortalLogin } from "@/components/client-portal/ClientPortalLogin";

export default async function ClientLoginPage() {
  const session = await getClientSession();
  if (session) {
    if (isClientMfaEnabled()) {
      const aal = await getClientMfaAssurance();
      if (needsMfaChallenge(aal)) {
        redirect("/client/mfa/challenge?next=%2Fclient");
      }
    }
    redirect("/client");
  }
  return <ClientPortalLogin />;
}
