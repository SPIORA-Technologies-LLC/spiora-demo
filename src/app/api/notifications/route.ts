import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { getSession } from "@/lib/auth/session";
import {
  getUnreadCount,
  listNotificationsForUser,
} from "@/lib/notifications/store";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "50");

  const locale = await getRequestLocale();

  const [notifications, unread] = await Promise.all([
    listNotificationsForUser(session.id, { limit, since, locale }),
    getUnreadCount(session.id),
  ]);

  return NextResponse.json({ notifications, unread });
}
