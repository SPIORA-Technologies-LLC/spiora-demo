import "server-only";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as sbRecordings from "@/lib/supabase/calendar-meeting-recordings-repo";
import {
  defaultGuestMeetingPreviewDeps,
  resolveGuestMeetingPreview,
  type GuestMeetingPreviewDeps,
} from "./meeting-guest-handler";
import { isMeetingRecordingActiveStatus } from "./meeting-recording-notice";

export type GuestRecordingStatusResult =
  | {
      recording: boolean;
      startedByName: string | null;
    }
  | { status: 400 | 404 | 503; error: string };

export async function handleGuestMeetingRecordingStatus(
  inviteToken: string,
  previewDeps: GuestMeetingPreviewDeps = defaultGuestMeetingPreviewDeps,
  getActiveByEvent: typeof sbRecordings.sbGetActiveMeetingRecordingByEvent = sbRecordings.sbGetActiveMeetingRecordingByEvent,
): Promise<GuestRecordingStatusResult> {
  const preview = await resolveGuestMeetingPreview(inviteToken, previewDeps);
  if ("error" in preview) {
    if (preview.error === "not_configured") {
      return { status: 503, error: "Meetings not configured" };
    }
    if (preview.error === "not_found") {
      return { status: 404, error: "Meeting not found" };
    }
    return { status: 400, error: "Invalid invite" };
  }

  if (!(previewDeps.isConfigured ?? isSupabaseConfigured)()) {
    return { recording: false, startedByName: null };
  }

  const active = await getActiveByEvent(preview.event.id);
  if (!active || !isMeetingRecordingActiveStatus(active.status)) {
    return { recording: false, startedByName: null };
  }

  return {
    recording: true,
    startedByName: active.startedByName || null,
  };
}
