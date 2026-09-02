"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { isLocalTrack, LocalVideoTrack } from "livekit-client";
import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
} from "@livekit/track-processors";
import {
  type MeetingBackgroundId,
  resolveMeetingBackgroundImageUrl,
  resolveMeetingBackgroundMode,
} from "@/lib/calendar/meeting-backgrounds";

export function useMeetingBackground(selectedId: MeetingBackgroundId) {
  const { cameraTrack } = useLocalParticipant();
  const processorRef = useRef<BackgroundProcessorWrapper | null>(null);
  const supported = supportsBackgroundProcessors();

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
        processorRef.current = BackgroundProcessor({ mode: "disabled" });
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

      await processorRef.current.switchTo({
        mode: "virtual-background",
        imagePath: resolveMeetingBackgroundImageUrl(mode.imagePath),
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
