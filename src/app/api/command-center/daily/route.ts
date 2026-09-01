import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getCommandCenterDailyBriefing,
  parseCommandCenterDayKey,
  resolveCommandCenterDayKey,
} from "@/lib/dashboard/daily-briefing";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  if (dateParam != null && dateParam.trim() !== "" && !parseCommandCenterDayKey(dateParam)) {
    return NextResponse.json(
      { error: "Invalid date; expected YYYY-MM-DD (Europe/Moscow)" },
      { status: 400 },
    );
  }

  const dayKey = resolveCommandCenterDayKey(dateParam);
  const briefing = await getCommandCenterDailyBriefing(session, { dayKey });

  return NextResponse.json({ dayKey, briefing });
}
