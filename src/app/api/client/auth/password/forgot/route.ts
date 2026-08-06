import { handlePasswordForgot } from "@/lib/auth/password-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string } = {};
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    body = {};
  }
  return handlePasswordForgot({ request, audience: "client", body });
}
