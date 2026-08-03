import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateAdminMessage } from "@/i18n/admin-messages";
import { getSession } from "@/lib/auth/session";
import {
  getMemberActivityStats,
  isValidActivityDayKey,
  type ActivityPeriod,
} from "@/lib/presence/daily-activity";
import { canViewTeamMemberActivity } from "@/lib/team/permissions";
import { findTeamUserById, isUserDeleted } from "@/lib/team/store";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const PERIODS = new Set<ActivityPeriod>(["day", "week", "month", "year"]);

function parsePeriod(value: string | null): ActivityPeriod {
  if (value && PERIODS.has(value as ActivityPeriod)) {
    return value as ActivityPeriod;
  }
  return "day";
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const { id } = await context.params;
  const target = await findTeamUserById(id);

  if (!target || (await isUserDeleted(id))) {
    return NextResponse.json(
      { error: translateAdminMessage(locale, "team.errors.notFound") },
      { status: 404 },
    );
  }

  if (!canViewTeamMemberActivity(session, target)) {
    return NextResponse.json(
      {
        error: translateAdminMessage(
          locale,
          "team.errors.activityForbidden",
        ),
      },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const anchorRaw = url.searchParams.get("anchor");
  const anchor =
    anchorRaw && isValidActivityDayKey(anchorRaw) ? anchorRaw : undefined;
  const stats = await getMemberActivityStats(id, period, anchor);

  return NextResponse.json({
    member: {
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
    },
    stats,
  });
}
