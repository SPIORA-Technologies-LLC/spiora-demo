import "server-only";

import { sortEventsByStartAt } from "./format";
import { listEventsInRange } from "./store";
import type { CalendarEvent } from "./types";

const UPCOMING_WINDOW_DAYS = 14;

export async function listUpcomingCalendarEvents(
  viewerUserId: string,
  limit = 5,
): Promise<CalendarEvent[]> {
  const now = new Date();
  const from = now.toISOString();
  const to = new Date(
    now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const events = await listEventsInRange({
    from,
    to,
    scopes: ["personal", "company"],
    viewerUserId,
  });

  const nowMs = now.getTime();
  return sortEventsByStartAt(events)
    .filter((event) => new Date(event.endAt).getTime() > nowMs)
    .slice(0, limit);
}
