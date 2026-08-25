import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EgressStatus } from "livekit-server-sdk";
import type { CalendarMeetingRecording } from "./types";
import { handleLiveKitEgressWebhook } from "./meeting-recording-handler";

function recording(
  overrides: Partial<CalendarMeetingRecording> = {},
): CalendarMeetingRecording {
  return {
    id: "rec-1",
    eventId: "evt-video",
    egressId: "eg-1",
    status: "processing",
    startedByUserId: "daniel-cooper",
    startedByName: "Daniel Cooper",
    storagePath: "evt-video/rec-1.mp4",
    fileName: "Test meeting-rec-1.mp4",
    durationSeconds: null,
    fileSizeBytes: null,
    errorMessage: null,
    startedAt: "2026-08-25T12:00:00.000Z",
    endedAt: null,
    createdAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

describe("handleLiveKitEgressWebhook recording notifications", () => {
  it("notifies once when egress completes", async () => {
    const current = recording();
    const notified: string[] = [];

    await handleLiveKitEgressWebhook(
      "eg-1",
      EgressStatus.EGRESS_COMPLETE,
      undefined,
      [{ filename: "evt-video/rec-1.mp4", size: 1024, duration: 60 }],
      {
        insertRecording: async () => current,
        updateRecording: async (_id, patch) => ({
          ...current,
          ...patch,
          status: patch.status ?? current.status,
        }),
        getRecordingById: async () => current,
        getActiveByEvent: async () => current,
        getByEgressId: async () => current,
        listRecordings: async () => [],
        deleteRecording: async () => undefined,
        notifyRecordingSaved: async ({ recording: item }) => {
          notified.push(item.id);
        },
      },
    );

    assert.deepEqual(notified, ["rec-1"]);
  });

  it("does not notify again when recording already complete", async () => {
    const current = recording({ status: "complete" });
    const notified: string[] = [];
    let updates = 0;

    await handleLiveKitEgressWebhook(
      "eg-1",
      EgressStatus.EGRESS_COMPLETE,
      undefined,
      [],
      {
        insertRecording: async () => current,
        updateRecording: async () => {
          updates += 1;
          return current;
        },
        getRecordingById: async () => current,
        getActiveByEvent: async () => current,
        getByEgressId: async () => current,
        listRecordings: async () => [],
        deleteRecording: async () => undefined,
        notifyRecordingSaved: async ({ recording: item }) => {
          notified.push(item.id);
        },
      },
    );

    assert.equal(updates, 0);
    assert.deepEqual(notified, []);
  });
});
