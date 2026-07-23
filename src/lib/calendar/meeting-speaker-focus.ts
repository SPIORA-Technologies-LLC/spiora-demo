import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import type { Participant } from "livekit-client";
import { Track } from "livekit-client";

/** Always use speaker + filmstrip (0 disables equal grid for any size). */
export const MEETING_GRID_MAX_PARTICIPANTS = 0;

export function pickCameraTracks(
  tracks: TrackReferenceOrPlaceholder[],
): TrackReferenceOrPlaceholder[] {
  return tracks.filter((track) => track.source === Track.Source.Camera);
}

export function pickScreenShareTrack(
  tracks: TrackReferenceOrPlaceholder[],
): TrackReferenceOrPlaceholder | undefined {
  return tracks.find((track) => track.source === Track.Source.ScreenShare);
}

/** Remote share only — local share must not render as focus (avoids mirror loop). */
export function pickRemoteScreenShareTrack(
  tracks: TrackReferenceOrPlaceholder[],
  localParticipantIdentity: string,
): TrackReferenceOrPlaceholder | undefined {
  return tracks.find(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.participant.identity !== localParticipantIdentity,
  );
}

export function isLocalScreenShareTrack(
  track: TrackReferenceOrPlaceholder | undefined,
  localParticipantIdentity: string,
): boolean {
  return Boolean(
    track &&
      track.source === Track.Source.ScreenShare &&
      track.participant.identity === localParticipantIdentity,
  );
}

export function resolveSpeakerFocusTrack(params: {
  cameraTracks: TrackReferenceOrPlaceholder[];
  screenShareTrack?: TrackReferenceOrPlaceholder;
  pinnedTrack?: TrackReferenceOrPlaceholder | null;
  activeSpeakers: Participant[];
  localParticipantIdentity: string;
}): TrackReferenceOrPlaceholder | null {
  // Only remote screen share takes over the main stage.
  if (
    params.screenShareTrack &&
    params.screenShareTrack.participant.identity !==
      params.localParticipantIdentity
  ) {
    return params.screenShareTrack;
  }

  // Active speaker always wins so the main stage follows who is talking.
  for (const speaker of params.activeSpeakers) {
    const match = params.cameraTracks.find(
      (track) => track.participant.identity === speaker.identity,
    );
    if (match) {
      return match;
    }
  }

  if (params.pinnedTrack) {
    const stillPresent = params.cameraTracks.some(
      (track) =>
        track.participant.identity === params.pinnedTrack?.participant.identity,
    );
    if (stillPresent) {
      return params.pinnedTrack;
    }
  }

  const localTrack = params.cameraTracks.find(
    (track) => track.participant.identity === params.localParticipantIdentity,
  );

  return localTrack ?? params.cameraTracks[0] ?? null;
}

export function resolveSpeakerCarouselTracks(
  cameraTracks: TrackReferenceOrPlaceholder[],
  focusTrack: TrackReferenceOrPlaceholder | null,
): TrackReferenceOrPlaceholder[] {
  if (!focusTrack || focusTrack.source === Track.Source.ScreenShare) {
    return cameraTracks;
  }

  return cameraTracks.filter(
    (track) => track.participant.identity !== focusTrack.participant.identity,
  );
}
