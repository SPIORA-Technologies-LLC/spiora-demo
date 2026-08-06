import { handleGoogleOAuthStart } from "@/lib/auth/google-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleGoogleOAuthStart({ request, audience: "employee" });
}
