import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateAdminMessage } from "@/i18n/admin-messages";
import { enforceAdminDemoGuard } from "@/lib/admin/demo-guard";
import { getSession } from "@/lib/auth/session";
import { deleteTeamMember } from "@/lib/team/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const demoBlocked = await enforceAdminDemoGuard("teamDelete");
  if (demoBlocked) {
    return demoBlocked;
  }

  const locale = await getRequestLocale();
  const { id } = await context.params;
  const result = await deleteTeamMember(session, id);

  if (!result.ok) {
    return NextResponse.json(
      { error: translateAdminMessage(locale, `team.errors.${result.error}`) },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true });
}
