import { handlePasswordReset } from "@/lib/auth/password-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { password?: string; locale?: string } = {};
  try {
    body = (await request.json()) as { password?: string; locale?: string };
  } catch {
    body = {};
  }
  return handlePasswordReset({ request, audience: "employee", body });
}
