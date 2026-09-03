import "server-only";

import { randomUUID } from "node:crypto";
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EgressStatus,
  RoomServiceClient,
  S3Upload,
} from "livekit-server-sdk";
import type { SessionUser } from "@/lib/auth/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as sbRecordings from "@/lib/supabase/calendar-meeting-recordings-repo";
import {
  handleGetCalendarEvent,
  type CalendarStoreDeps,
  defaultCalendarStoreDeps,
} from "./handlers";
import { getMeetingRoomName } from "./meeting";
import { MeetingAccessError } from "./meeting-access";
import {
  assertCanManageMeetingRecording,
  assertCanStopMeetingRecording,
  canViewMeetingRecording,
} from "./meeting-recording-access";
import {
  collectLiveKitFileResults,
  liveKitDurationToSeconds,
  liveKitFileSizeToBytes,
} from "./meeting-recording-duration";
import { buildMeetingRecordingRoomMetadata } from "./meeting-recording-notice";
import {
  buildMeetingRecordingStoragePath,
  createMeetingRecordingPlaybackUrl,
  deleteMeetingRecordingFile,
  getEgressStorageConfig,
  getLiveKitApiHost,
} from "./meeting-recording-storage";
import { getLiveKitEnv } from "./meeting-token";
import { canViewEvent } from "./permissions";
import type {
  CalendarMeetingRecording,
  CalendarMeetingRecordingWithEvent,
} from "./types";
import { notifyMeetingRecordingSaved } from "@/lib/notifications/emit";

export type MeetingRecordingHandlerError = {
  status: 400 | 403 | 404 | 409 | 422 | 503;
  error: string;
};

export type MeetingRecordingDeps = {
  insertRecording: typeof sbRecordings.sbInsertMeetingRecording;
  updateRecording: typeof sbRecordings.sbUpdateMeetingRecording;
  getRecordingById: typeof sbRecordings.sbGetMeetingRecordingById;
  getActiveByEvent: typeof sbRecordings.sbGetActiveMeetingRecordingByEvent;
  getByEgressId: typeof sbRecordings.sbGetMeetingRecordingByEgressId;
  listRecordings: typeof sbRecordings.sbListMeetingRecordings;
  deleteRecording: typeof sbRecordings.sbDeleteMeetingRecording;
  isConfigured?: () => boolean;
  notifyRecordingSaved?: typeof notifyMeetingRecordingSaved;
};

export const defaultMeetingRecordingDeps: MeetingRecordingDeps = {
  insertRecording: sbRecordings.sbInsertMeetingRecording,
  updateRecording: sbRecordings.sbUpdateMeetingRecording,
  getRecordingById: sbRecordings.sbGetMeetingRecordingById,
  getActiveByEvent: sbRecordings.sbGetActiveMeetingRecordingByEvent,
  getByEgressId: sbRecordings.sbGetMeetingRecordingByEgressId,
  listRecordings: sbRecordings.sbListMeetingRecordings,
  deleteRecording: sbRecordings.sbDeleteMeetingRecording,
  isConfigured: isSupabaseConfigured,
  notifyRecordingSaved: notifyMeetingRecordingSaved,
};

async function markRecordingCompleteAndNotify(
  recording: CalendarMeetingRecording,
  patch: {
    storagePath?: string | null;
    fileName?: string | null;
    durationSeconds?: number | null;
    fileSizeBytes?: number | null;
    endedAt?: string | null;
    errorMessage?: string | null;
  },
  deps: MeetingRecordingDeps,
): Promise<CalendarMeetingRecording> {
  if (recording.status === "complete") {
    return recording;
  }

  const basePatch = {
    status: "complete" as const,
    storagePath:
      patch.storagePath !== undefined
        ? patch.storagePath
        : recording.storagePath,
    fileName:
      patch.fileName !== undefined ? patch.fileName : recording.fileName,
    durationSeconds:
      patch.durationSeconds !== undefined
        ? patch.durationSeconds
        : recording.durationSeconds,
    fileSizeBytes:
      patch.fileSizeBytes !== undefined
        ? patch.fileSizeBytes
        : recording.fileSizeBytes,
    endedAt: patch.endedAt ?? new Date().toISOString(),
    errorMessage: patch.errorMessage ?? null,
  };

  let updated: CalendarMeetingRecording | null = null;
  try {
    updated = await deps.updateRecording(recording.id, basePatch);
  } catch (error) {
    // Never lose a completed recording because of bad duration/size metadata.
    console.error(
      "[meeting-recording] complete update failed; retrying without metrics",
      error,
    );
    updated = await deps.updateRecording(recording.id, {
      status: "complete",
      storagePath: basePatch.storagePath,
      fileName: basePatch.fileName,
      durationSeconds: null,
      fileSizeBytes: null,
      endedAt: basePatch.endedAt,
      errorMessage: null,
    });
  }

  const finalRecording =
    updated ??
    ({
      ...recording,
      ...basePatch,
      status: "complete" as const,
    } satisfies CalendarMeetingRecording);

  const notify = deps.notifyRecordingSaved ?? notifyMeetingRecordingSaved;
  void notify({ recording: finalRecording }).catch((error) => {
    console.error("[meeting-recording] notify saved failed", error);
  });

  return finalRecording;
}

function createEgressClient(env: NonNullable<ReturnType<typeof getLiveKitEnv>>) {
  return new EgressClient(
    getLiveKitApiHost(env.url),
    env.apiKey,
    env.apiSecret,
  );
}

function createRoomServiceClient(
  env: NonNullable<ReturnType<typeof getLiveKitEnv>>,
) {
  return new RoomServiceClient(
    getLiveKitApiHost(env.url),
    env.apiKey,
    env.apiSecret,
  );
}

async function publishRecordingRoomNotice(
  eventId: string,
  env: NonNullable<ReturnType<typeof getLiveKitEnv>>,
  notice: { recording: boolean; startedByName?: string },
): Promise<void> {
  try {
    const rooms = createRoomServiceClient(env);
    await rooms.updateRoomMetadata(
      getMeetingRoomName(eventId),
      buildMeetingRecordingRoomMetadata(notice),
    );
  } catch (error) {
    console.error("[meeting-recording] room notice metadata failed", error);
  }
}

function buildEncodedFileOutput(storagePath: string): EncodedFileOutput {
  const storage = getEgressStorageConfig();
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath: storagePath,
    disableManifest: true,
  });

  if (storage) {
    output.output = {
      case: "s3",
      value: new S3Upload({
        accessKey: storage.accessKey,
        secret: storage.secret,
        bucket: storage.bucket,
        endpoint: storage.endpoint,
        region: storage.region,
        forcePathStyle: true,
      }),
    };
  }

  return output;
}

export async function handleStartMeetingRecording(
  session: SessionUser,
  eventId: string,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<{ recording: CalendarMeetingRecording } | MeetingRecordingHandlerError> {
  const eventResult = await handleGetCalendarEvent(session, eventId, storeDeps);
  if ("status" in eventResult) {
    return { status: eventResult.status, error: eventResult.error };
  }

  try {
    assertCanManageMeetingRecording(session, eventResult.event);
  } catch (error) {
    if (error instanceof MeetingAccessError) {
      return { status: 403, error: error.message };
    }
    throw error;
  }

  if (!(deps.isConfigured ?? isSupabaseConfigured)()) {
    return { status: 503, error: "Meeting recordings not configured" };
  }

  const liveKitEnv = getLiveKitEnv();
  if (!liveKitEnv) {
    return { status: 503, error: "Meetings not configured" };
  }

  if (!getEgressStorageConfig()) {
    return {
      status: 503,
      error: "Recording storage not configured (LIVEKIT_EGRESS_S3_*)",
    };
  }

  const active = await deps.getActiveByEvent(eventId);
  if (active) {
    return { status: 409, error: "Recording already in progress" };
  }

  const recordingId = randomUUID();
  const storagePath = buildMeetingRecordingStoragePath(eventId, recordingId);
  const fileName = `${eventResult.event.title.trim() || "meeting"}-${recordingId.slice(0, 8)}.mp4`;

  const recording = await deps.insertRecording({
    id: recordingId,
    eventId,
    status: "starting",
    startedByUserId: session.id,
    startedByName: session.name,
    storagePath,
    fileName,
  });

  try {
    const egressClient = createEgressClient(liveKitEnv);
    const egressInfo = await egressClient.startRoomCompositeEgress(
      getMeetingRoomName(eventId),
      { file: buildEncodedFileOutput(storagePath) },
      { audioOnly: false },
    );

    const updated = await deps.updateRecording(recording.id, {
      egressId: egressInfo.egressId,
      status: "active",
    });

    await publishRecordingRoomNotice(eventId, liveKitEnv, {
      recording: true,
      startedByName: session.name,
    });

    return { recording: updated ?? recording };
  } catch (error) {
    await deps.updateRecording(recording.id, {
      status: "failed",
      errorMessage:
        error instanceof Error ? error.message : "Failed to start recording",
      endedAt: new Date().toISOString(),
    });
    return { status: 503, error: "Failed to start recording" };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After stopEgress, poll LiveKit for completion so recordings appear even
 * when webhooks are disabled (common in local/demo).
 */
async function finalizeRecordingAfterStop(
  recording: CalendarMeetingRecording,
  liveKitEnv: NonNullable<ReturnType<typeof getLiveKitEnv>>,
  deps: MeetingRecordingDeps,
  options: {
    maxAttempts?: number;
    delayMs?: number;
    /** When false, do not mark complete unless LiveKit already finished. */
    allowFallbackComplete?: boolean;
  } = {},
): Promise<CalendarMeetingRecording> {
  const maxAttempts = options.maxAttempts ?? 15;
  const delayMs = options.delayMs ?? 1500;
  const allowFallbackComplete = options.allowFallbackComplete !== false;

  if (!recording.egressId) {
    if (!allowFallbackComplete) {
      return recording;
    }
    const updated = await deps.updateRecording(recording.id, {
      status: "complete",
      endedAt: new Date().toISOString(),
      errorMessage: null,
    });
    return updated ?? recording;
  }

  const egressClient = createEgressClient(liveKitEnv);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(delayMs);

    try {
      const infos = await egressClient.listEgress({
        egressId: recording.egressId,
      });
      const info = infos[0];
      if (!info) continue;

      if (info.status === EgressStatus.EGRESS_COMPLETE) {
        const files = collectLiveKitFileResults(info);
        await handleLiveKitEgressWebhook(
          recording.egressId,
          info.status,
          info.error,
          files.map((file) => ({
            filename: file.filename,
            size: file.size,
            duration: file.duration,
          })),
          deps,
        );
        return (
          (await deps.getRecordingById(recording.id)) ??
          recording
        );
      }

      if (
        info.status === EgressStatus.EGRESS_FAILED ||
        info.status === EgressStatus.EGRESS_ABORTED ||
        info.status === EgressStatus.EGRESS_LIMIT_REACHED
      ) {
        await handleLiveKitEgressWebhook(
          recording.egressId,
          info.status,
          info.error,
          [],
          deps,
        );
        return (
          (await deps.getRecordingById(recording.id)) ??
          recording
        );
      }
    } catch {
      // keep polling / fall through to known storage path
    }
  }

  if (!allowFallbackComplete) {
    return recording;
  }

  // Fallback when webhook/poll unavailable: trust planned S3 path from start.
  return markRecordingCompleteAndNotify(
    recording,
    {
      storagePath: recording.storagePath,
      endedAt: new Date().toISOString(),
      errorMessage: null,
    },
    deps,
  );
}

export async function handleStopMeetingRecording(
  session: SessionUser,
  eventId: string,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<{ recording: CalendarMeetingRecording } | MeetingRecordingHandlerError> {
  const eventResult = await handleGetCalendarEvent(session, eventId, storeDeps);
  if ("status" in eventResult) {
    return { status: eventResult.status, error: eventResult.error };
  }

  try {
    assertCanStopMeetingRecording(session, eventResult.event);
  } catch (error) {
    if (error instanceof MeetingAccessError) {
      return { status: 403, error: error.message };
    }
    throw error;
  }

  const liveKitEnv = getLiveKitEnv();
  if (!liveKitEnv) {
    return { status: 503, error: "Meetings not configured" };
  }

  const active = await deps.getActiveByEvent(eventId);
  if (!active?.egressId) {
    return { status: 404, error: "No active recording" };
  }

  if (active.status === "processing") {
    try {
      const finalized = await finalizeRecordingAfterStop(
        active,
        liveKitEnv,
        deps,
      );
      return { recording: finalized };
    } catch (error) {
      console.error("[meeting-recording] finalize retry failed", error);
      return { recording: active };
    }
  }

  try {
    const egressClient = createEgressClient(liveKitEnv);
    await egressClient.stopEgress(active.egressId);
  } catch (error) {
    // Egress may already have ended when the room emptied — still finalize.
    const message = error instanceof Error ? error.message : "";
    if (!/not found|already|ended|complete/i.test(message)) {
      return {
        status: 503,
        error: message || "Failed to stop recording",
      };
    }
  }

  await deps.updateRecording(active.id, {
    status: "processing",
  });

  await publishRecordingRoomNotice(eventId, liveKitEnv, { recording: false });

  let finalized: CalendarMeetingRecording;
  try {
    finalized = await finalizeRecordingAfterStop(
      { ...active, status: "processing" },
      liveKitEnv,
      deps,
    );
  } catch (error) {
    console.error("[meeting-recording] finalize after stop failed", error);
    finalized =
      (await deps.getRecordingById(active.id)) ??
      ({ ...active, status: "processing" as const });
  }

  return { recording: finalized };
}

export async function handleDeleteMeetingRecording(
  session: SessionUser,
  recordingId: string,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<{ ok: true } | MeetingRecordingHandlerError> {
  const recording = await deps.getRecordingById(recordingId);
  if (!recording) {
    return { status: 404, error: "Recording not found" };
  }

  const event = await storeDeps.getEvent(recording.eventId);
  if (!event || !canViewEvent(session, event)) {
    return { status: 403, error: "Forbidden" };
  }

  if (recording.storagePath) {
    try {
      await deleteMeetingRecordingFile(recording.storagePath);
    } catch (error) {
      console.error("[meeting-recording] storage delete failed", error);
    }
  }

  await deps.deleteRecording(recording.id);
  return { ok: true };
}

export async function handleGetMeetingRecordingStatus(
  session: SessionUser,
  eventId: string,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<
  | { recording: CalendarMeetingRecording | null }
  | MeetingRecordingHandlerError
> {
  const eventResult = await handleGetCalendarEvent(session, eventId, storeDeps);
  if ("status" in eventResult) {
    return { status: eventResult.status, error: eventResult.error };
  }

  try {
    assertCanStopMeetingRecording(session, eventResult.event);
  } catch (error) {
    if (error instanceof MeetingAccessError) {
      return { status: 403, error: error.message };
    }
    throw error;
  }

  const active = await deps.getActiveByEvent(eventId);

  if (
    active &&
    (active.status === "processing" || active.status === "active") &&
    active.egressId &&
    getLiveKitEnv()
  ) {
    const liveKitEnv = getLiveKitEnv();
    if (liveKitEnv) {
      try {
        const finalized = await finalizeRecordingAfterStop(
          active,
          liveKitEnv,
          deps,
          {
            maxAttempts: active.status === "processing" ? 8 : 2,
            delayMs: 500,
            allowFallbackComplete: active.status === "processing",
          },
        );
        return { recording: finalized };
      } catch {
        return { recording: active };
      }
    }
  }

  return { recording: active };
}

export async function handleListMeetingRecordings(
  session: SessionUser,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<
  { recordings: CalendarMeetingRecordingWithEvent[] } | MeetingRecordingHandlerError
> {
  if (!(deps.isConfigured ?? isSupabaseConfigured)()) {
    return { status: 503, error: "Meeting recordings not configured" };
  }

  const liveKitEnv = getLiveKitEnv();
  const all = await deps.listRecordings();
  const visible: CalendarMeetingRecordingWithEvent[] = [];

  for (const item of all) {
    let recording: CalendarMeetingRecordingWithEvent = item;

    if (
      liveKitEnv &&
      recording.egressId &&
      (recording.status === "processing" || recording.status === "active")
    ) {
      try {
        const finalized = await finalizeRecordingAfterStop(
          recording,
          liveKitEnv,
          deps,
          { maxAttempts: 2, delayMs: 400, allowFallbackComplete: false },
        );
        recording = {
          ...recording,
          ...finalized,
          eventTitle: item.eventTitle,
          eventStartAt: item.eventStartAt,
          linkedClientId: item.linkedClientId,
          linkedClientName: item.linkedClientName,
        };
      } catch (error) {
        console.error(
          "[meeting-recording] list reclaim failed",
          recording.id,
          error,
        );
      }
    }

    if (recording.status !== "complete" || !recording.storagePath) {
      continue;
    }

    const eventResult = await storeDeps.getEvent(recording.eventId);
    if (!eventResult || !canViewEvent(session, eventResult)) {
      continue;
    }

    visible.push(recording);
  }

  return { recordings: visible };
}

export async function handleGetMeetingRecordingPlayback(
  session: SessionUser,
  recordingId: string,
  storeDeps: CalendarStoreDeps = defaultCalendarStoreDeps,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<{ playbackUrl: string } | MeetingRecordingHandlerError> {
  const recording = await deps.getRecordingById(recordingId);
  if (!recording) {
    return { status: 404, error: "Recording not found" };
  }

  const event = await storeDeps.getEvent(recording.eventId);
  if (!event || !canViewMeetingRecording(session, event, recording)) {
    return { status: 403, error: "Forbidden" };
  }

  if (!recording.storagePath) {
    return { status: 404, error: "Recording file not available" };
  }

  const playbackUrl = await createMeetingRecordingPlaybackUrl(
    recording.storagePath,
  );
  if (!playbackUrl) {
    return { status: 404, error: "Recording file not available" };
  }

  return { playbackUrl };
}

export async function handleLiveKitEgressWebhook(
  egressId: string,
  status: EgressStatus,
  errorMessage: string | undefined,
  fileResults: Array<{
    filename?: string;
    size?: bigint | number;
    duration?: bigint | number;
  }>,
  deps: MeetingRecordingDeps = defaultMeetingRecordingDeps,
): Promise<void> {
  const recording = await deps.getByEgressId(egressId);
  if (!recording) {
    return;
  }

  if (status === EgressStatus.EGRESS_COMPLETE) {
    const file = fileResults[0];
    const storagePath =
      file?.filename?.trim() || recording.storagePath || null;

    await markRecordingCompleteAndNotify(
      recording,
      {
        storagePath,
        fileName: recording.fileName,
        durationSeconds:
          liveKitDurationToSeconds(file?.duration) ??
          recording.durationSeconds,
        fileSizeBytes:
          liveKitFileSizeToBytes(file?.size) ?? recording.fileSizeBytes,
        endedAt: new Date().toISOString(),
        errorMessage: null,
      },
      deps,
    );
    return;
  }

  if (
    status === EgressStatus.EGRESS_FAILED ||
    status === EgressStatus.EGRESS_ABORTED ||
    status === EgressStatus.EGRESS_LIMIT_REACHED
  ) {
    await deps.updateRecording(recording.id, {
      status: "failed",
      errorMessage: errorMessage ?? "Recording failed",
      endedAt: new Date().toISOString(),
    });
    return;
  }

  if (status === EgressStatus.EGRESS_ENDING) {
    await deps.updateRecording(recording.id, {
      status: "processing",
    });
  }
}
