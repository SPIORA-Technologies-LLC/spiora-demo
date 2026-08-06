import { handleRecoveryConfirm } from "@/lib/auth/password-handlers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRecoveryConfirm({ request, audience: "client" });
}
