import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { assertCanJoinMeeting, MeetingAccessError } from "./meeting-access";
import { isVideoMeeting } from "./meeting";
import { canViewEvent } from "./permissions";
import type { CalendarEvent, CalendarMeetingRecording } from "./types";
import { isUserRole } from "@/lib/auth/users";

export function assertCanManageMeetingRecording(
  user: SessionUser,
  event: CalendarEvent,
  now: Date = new Date(),
): void {
  assertCanJoinMeeting(user, event, now);
}

/** Stop/finalize must work after the join window closes. */
export function assertCanStopMeetingRecording(
  user: SessionUser,
  event: CalendarEvent,
): void {
  if (!isUserRole(user.role)) {
    throw new MeetingAccessError("Forbidden", "invalid_role");
  }

  if (!canViewEvent(user, event)) {
    throw new MeetingAccessError("Forbidden", "forbidden");
  }

  if (!isVideoMeeting(event)) {
    throw new MeetingAccessError("Not a video meeting", "not_video_meeting");
  }
}

export function canViewMeetingRecording(
  user: SessionUser,
  event: CalendarEvent,
  recording: CalendarMeetingRecording,
): boolean {
  if (recording.status !== "complete" || !recording.storagePath) {
    return false;
  }

  return canViewEvent(user, event);
}
