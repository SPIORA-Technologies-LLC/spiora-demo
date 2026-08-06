import { handleGoogleOAuthCallback } from "@/lib/auth/google-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleGoogleOAuthCallback({ request, audience: "employee" });
}
