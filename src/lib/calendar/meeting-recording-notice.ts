export type MeetingRecordingRoomNotice = {
  recording: boolean;
  startedByName?: string;
};

export function buildMeetingRecordingRoomMetadata(
  notice: MeetingRecordingRoomNotice,
): string {
  return JSON.stringify({
    spioraRecording: Boolean(notice.recording),
    ...(notice.startedByName
      ? { spioraRecordingBy: notice.startedByName.trim().slice(0, 80) }
      : {}),
  });
}

export function parseMeetingRecordingRoomMetadata(
  metadata: string | undefined | null,
): MeetingRecordingRoomNotice {
  if (!metadata?.trim()) {
    return { recording: false };
  }

  try {
    const parsed = JSON.parse(metadata) as {
      spioraRecording?: unknown;
      spioraRecordingBy?: unknown;
    };
    const recording = parsed.spioraRecording === true;
    const startedByName =
      typeof parsed.spioraRecordingBy === "string" &&
      parsed.spioraRecordingBy.trim()
        ? parsed.spioraRecordingBy.trim()
        : undefined;
    return startedByName ? { recording, startedByName } : { recording };
  } catch {
    return { recording: false };
  }
}

export function isMeetingRecordingActiveStatus(
  status: string | null | undefined,
): boolean {
  return status === "active" || status === "starting";
}
