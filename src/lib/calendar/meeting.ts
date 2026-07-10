import type { CalendarEvent } from "./types";

export { getMeetingRoomName } from "@/config/branding";

export function isVideoMeeting(
  event: Pick<CalendarEvent, "eventType">,
): boolean {
  return event.eventType === "video_meeting";
}
