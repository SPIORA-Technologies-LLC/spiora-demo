import { VideoPresets } from "livekit-client";

/** Shared LiveKit room options for staff + guest meetings. */
export const MEETING_ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },
} as const;
