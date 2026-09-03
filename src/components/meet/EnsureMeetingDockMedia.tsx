"use client";

import { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";

/**
 * After minimize, the main tab often still holds the camera for a moment while
 * the dock window connects. LiveKitRoom's initial `video` enable can fail; retry
 * until the device is free so the dock shows local video.
 */
export function EnsureMeetingDockMedia({ enabled }: { enabled: boolean }) {
  const room = useRoomContext();
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const runId = ++runIdRef.current;
    let cancelled = false;

    async function ensureDevices() {
      for (let attempt = 0; attempt < 8; attempt++) {
        if (cancelled || runIdRef.current !== runId) {
          return;
        }

        try {
          if (!room.localParticipant.isMicrophoneEnabled) {
            await room.localParticipant.setMicrophoneEnabled(true);
          }
          if (!room.localParticipant.isCameraEnabled) {
            await room.localParticipant.setCameraEnabled(true);
          }
          if (room.localParticipant.isCameraEnabled) {
            return;
          }
        } catch {
          // Camera may still be held by the previous tab — retry.
        }

        await new Promise((resolve) => {
          window.setTimeout(resolve, 350 + attempt * 150);
        });
      }
    }

    void ensureDevices();

    return () => {
      cancelled = true;
    };
  }, [enabled, room]);

  return null;
}
