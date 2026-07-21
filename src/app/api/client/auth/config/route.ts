import { isClientPortalDemoAuthEnabled } from "@/lib/client-portal/demo-auth";
import { clientApiOk } from "@/lib/client-portal/api-errors";

export const dynamic = "force-dynamic";

export async function GET() {
  return clientApiOk({
    skipEmailConfirmation: isClientPortalDemoAuthEnabled(),
  });
}
