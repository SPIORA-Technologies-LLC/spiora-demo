"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { isLocalTrack, LocalVideoTrack } from "livekit-client";
import { prepareMeetingBackgroundImageUrl } from "@/lib/calendar/prepare-meeting-background-image";
import {
  type MeetingBackgroundId,
  resolveMeetingBackgroundMode,
} from "@/lib/calendar/meeting-backgrounds";
import {
  createSmoothedBackgroundProcessor,
  supportsSmoothedBackgroundProcessors,
  type SmoothedBackgroundProcessorHandle,
} from "./smoothed-background-processor";

export function useMeetingBackground(selectedId: MeetingBackgroundId) {
  const { cameraTrack } = useLocalParticipant();
  const processorRef = useRef<
    (ReturnType<typeof createSmoothedBackgroundProcessor> &
      SmoothedBackgroundProcessorHandle) | null
  >(null);
  const supported = supportsSmoothedBackgroundProcessors();

  useEffect(() => {
    if (!supported) {
      return;
    }

    const track = cameraTrack?.track;
    if (!track || !isLocalTrack(track) || track.kind !== "video") {
      return;
    }

    const localVideoTrack = track as LocalVideoTrack;
    let cancelled = false;

    async function applyBackground() {
      const mode = resolveMeetingBackgroundMode(selectedId);

      if (mode.type === "none") {
        if (processorRef.current) {
          await processorRef.current.switchTo({ mode: "disabled" });
        } else if (localVideoTrack.getProcessor()) {
          await localVideoTrack.stopProcessor();
        }
        return;
      }

      if (!processorRef.current) {
        processorRef.current = createSmoothedBackgroundProcessor();
        if (!localVideoTrack.getProcessor()) {
          await localVideoTrack.setProcessor(processorRef.current);
        }
      }

      if (cancelled) {
        return;
      }

      if (mode.type === "blur") {
        await processorRef.current.switchTo({
          mode: "background-blur",
          blurRadius: mode.blurRadius,
        });
        return;
      }

      const imagePath = await prepareMeetingBackgroundImageUrl(mode.imagePath);
      if (cancelled) {
        return;
      }

      await processorRef.current.switchTo({
        mode: "virtual-background",
        imagePath,
      });
    }

    void applyBackground().catch((error) => {
      console.error("[meeting-background] apply failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [cameraTrack, selectedId, supported]);

  useEffect(() => {
    return () => {
      processorRef.current = null;
    };
  }, []);

  return { supported };
}
