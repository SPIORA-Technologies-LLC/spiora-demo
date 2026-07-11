import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateAdminMessage } from "@/i18n/admin-messages";
import { enforceAdminDemoGuard } from "@/lib/admin/demo-guard";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { getSession } from "@/lib/auth/session";
import { listTeamUsers } from "@/lib/auth/users";
import {
  generateTemporaryPassword,
  getStoredPasswordMeta,
  setUserPassword,
  validateNewPassword,
} from "@/lib/auth/password-store";
import { isUserDeleted } from "@/lib/team/store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await Promise.all(
    listTeamUsers().map(async (user) => {
      const meta = await getStoredPasswordMeta(user.id);
      const deleted = await isUserDeleted(user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        deleted,
        hasCustomPassword: Boolean(meta),
        passwordUpdatedAt: meta?.updatedAt ?? null,
        passwordUpdatedBy: meta?.updatedByName ?? null,
      };
    }),
  );

  return NextResponse.json({ members, demo: isDemoMode() });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const demoBlocked = await enforceAdminDemoGuard("settingsPasswordReset");
  if (demoBlocked) {
    return demoBlocked;
  }

  const locale = await getRequestLocale();

  const body = (await request.json().catch(() => null)) as {
    userId?: string;
    password?: string;
    generate?: boolean;
  } | null;

  const userId = body?.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "User is required" }, { status: 400 });
  }

  const user = listTeamUsers().find((item) => item.id === userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (await isUserDeleted(user.id)) {
    return NextResponse.json(
      {
        error: translateAdminMessage(
          locale,
          "settings.security.password.errors.deletedUser",
        ),
      },
      { status: 400 },
    );
  }

  const password = body?.generate
    ? generateTemporaryPassword()
    : String(body?.password ?? "");

  const validationError = validateNewPassword(password);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    await setUserPassword({
      userId: user.id,
      password,
      updatedByUserId: session.id,
      updatedByName: session.name,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset password";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    userName: user.name,
    email: user.email,
    password,
  });
}
