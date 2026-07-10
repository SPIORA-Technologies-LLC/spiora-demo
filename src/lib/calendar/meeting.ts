import type { CalendarEvent } from "./types";

export function isVideoMeeting(
  event: Pick<CalendarEvent, "eventType">,
): boolean {
  return event.eventType === "video_meeting";
}

export function getMeetingRoomName(eventId: string): string {
  return `northstar-cal-${eventId}`;
}
