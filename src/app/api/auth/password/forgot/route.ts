import { handlePasswordForgot } from "@/lib/auth/password-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: string; locale?: string } = {};
  try {
    body = (await request.json()) as { email?: string; locale?: string };
  } catch {
    body = {};
  }
  return handlePasswordForgot({ request, audience: "employee", body });
}
