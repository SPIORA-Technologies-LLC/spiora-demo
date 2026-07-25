import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateAdminMessage } from "@/i18n/admin-messages";
import { isDemoMode } from "@/lib/demo/demo-mode";
import { getSession } from "@/lib/auth/session";
import {
  generateTemporaryPassword,
} from "@/lib/auth/password-store";
import {
  AI_REQUEST_STATS_DAYS,
  countAiUserMessagesByUserId,
} from "@/lib/dashboard/ai-request-stats";
import { getDailyActivityMap } from "@/lib/presence/daily-activity";
import { getPresenceMap } from "@/lib/presence/store";
import { canManageTeam } from "@/lib/team/permissions";
import { createTeamManager, listTeamMembers } from "@/lib/team/store";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await listTeamMembers();
  const memberIds = members.map((member) => member.id);
  const [presence, aiCounts, activity] = await Promise.all([
    getPresenceMap(memberIds),
    countAiUserMessagesByUserId(AI_REQUEST_STATS_DAYS, memberIds),
    getDailyActivityMap(memberIds),
  ]);

  const enrichedMembers = members.map((member) => ({
    ...member,
    isOnline: presence[member.id]?.isOnline ?? false,
    lastActiveAt: presence[member.id]?.lastActiveAt || null,
    aiRequestsThisMonth: aiCounts[member.id] ?? 0,
    activityToday: activity[member.id],
  }));
  const onlineCount = enrichedMembers.filter((member) => member.isOnline).length;
  const canManage = canManageTeam(session);

  return NextResponse.json({
    members: enrichedMembers,
    canDelete: canManage,
    canManage,
    onlineCount,
    demo: isDemoMode(),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    generatePassword?: boolean;
  } | null;

  const password = body?.generatePassword
    ? generateTemporaryPassword()
    : String(body?.password ?? "");

  const result = await createTeamManager(session, {
    name: String(body?.name ?? ""),
    email: String(body?.email ?? ""),
    password,
  });

  if (!result.ok) {
    const status =
      result.error === "createForbidden"
        ? 403
        : result.error === "emailTaken"
          ? 409
          : 400;
    return NextResponse.json(
      {
        error:
          result.detail ??
          translateAdminMessage(locale, `team.errors.${result.error}`),
      },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    member: result.member,
    temporaryPassword: body?.generatePassword ? result.password : undefined,
  });
}
