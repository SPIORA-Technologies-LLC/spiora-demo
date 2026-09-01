import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseCommandCenterDayKey, resolveCommandCenterDayKey } from "@/lib/dashboard/daily-briefing";
import {
  listPlatformActivityForDay,
  parseActivityFeedCursor,
} from "@/lib/dashboard/platform-activity-feed";

function parseLimit(value: string | null): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  if (
    dateParam != null &&
    dateParam.trim() !== "" &&
    !parseCommandCenterDayKey(dateParam)
  ) {
    return NextResponse.json(
      { error: "Invalid date; expected YYYY-MM-DD (Europe/Moscow)" },
      { status: 400 },
    );
  }

  const cursorParam = url.searchParams.get("cursor");
  if (cursorParam != null && cursorParam.trim() !== "" && !parseActivityFeedCursor(cursorParam)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const dayKey = resolveCommandCenterDayKey(dateParam);
  const page = await listPlatformActivityForDay(session, {
    dayKey,
    limit: parseLimit(url.searchParams.get("limit")),
    cursor: cursorParam,
  });

  return NextResponse.json(page);
}
