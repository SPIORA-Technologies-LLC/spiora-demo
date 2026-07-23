import { getClientSession } from "@/lib/client-portal/session";
import { clientApiError, clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getClientSession();
  if (!session) return clientApiError("UNAUTHORIZED", 401);
  return clientApiOk({
    session: {
      id: session.id,
      email: session.email,
      firstName: session.firstName,
      preferredLocale: session.preferredLocale,
    },
  });
}
