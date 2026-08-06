import { handlePasswordChange } from "@/lib/auth/password-handlers";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { currentPassword?: string; newPassword?: string } = {};
  try {
    body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
  } catch {
    body = {};
  }
  return handlePasswordChange({ request, audience: "client", body });
}
