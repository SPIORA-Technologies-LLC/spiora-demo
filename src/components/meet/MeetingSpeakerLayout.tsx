"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ParticipantClickEvent } from "@livekit/components-core";
import {
  getTrackReferenceId,
  isTrackReference,
} from "@livekit/components-core";
import {
  GridLayout,
  ParticipantTile,
  useLocalParticipant,
  useSpeakingParticipants,
  useTracks,
} from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import {
  MEETING_GRID_MAX_PARTICIPANTS,
  isLocalScreenShareTrack,
  pickCameraTracks,
  pickRemoteScreenShareTrack,
  pickScreenShareTrack,
  resolveSpeakerCarouselTracks,
  resolveSpeakerFocusTrack,
} from "@/lib/calendar/meeting-speaker-focus";
import styles from "./CalendarMeetRoom.module.css";

export function MeetingSpeakerLayout({ compact = false }: { compact?: boolean }) {
  const { localParticipant } = useLocalParticipant();
  const activeSpeakers = useSpeakingParticipants();
  const lastActiveSpeakerIdentityRef = useRef<string | null>(null);
  const [lastActiveSpeakerIdentity, setLastActiveSpeakerIdentity] = useState<
    string | null
  >(null);
  const [pinnedTrack, setPinnedTrack] = useState<
    ReturnType<typeof useTracks>[number] | null
  >(null);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      updateOnlyOn: [
        RoomEvent.ActiveSpeakersChanged,
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
      ],
      onlySubscribed: false,
    },
  );

  const cameraTracks = useMemo(() => pickCameraTracks(tracks), [tracks]);
  const anyScreenShareTrack = useMemo(() => pickScreenShareTrack(tracks), [tracks]);
  const screenShareTrack = useMemo(
    () => pickRemoteScreenShareTrack(tracks, localParticipant.identity),
    [localParticipant.identity, tracks],
  );
  const localIsSharing = isLocalScreenShareTrack(
    anyScreenShareTrack,
    localParticipant.identity,
  );

  useEffect(() => {
    const next = activeSpeakers[0]?.identity;
    if (!next || next === lastActiveSpeakerIdentityRef.current) {
      return;
    }
    lastActiveSpeakerIdentityRef.current = next;
    setLastActiveSpeakerIdentity(next);
  }, [activeSpeakers]);

  const useGridLayout =
    !screenShareTrack &&
    !localIsSharing &&
    !compact &&
    cameraTracks.length <= MEETING_GRID_MAX_PARTICIPANTS;

  const focusTrack = useMemo(
    () =>
      useGridLayout
        ? null
        : resolveSpeakerFocusTrack({
            cameraTracks,
            screenShareTrack,
            pinnedTrack: screenShareTrack ? null : pinnedTrack,
            activeSpeakers,
            lastActiveSpeakerIdentity,
            localParticipantIdentity: localParticipant.identity,
          }),
    [
      activeSpeakers,
      cameraTracks,
      lastActiveSpeakerIdentity,
      localParticipant.identity,
      pinnedTrack,
      screenShareTrack,
      useGridLayout,
    ],
  );

  const carouselTracks = useMemo(
    () => resolveSpeakerCarouselTracks(cameraTracks, focusTrack),
    [cameraTracks, focusTrack],
  );

  function handleParticipantClick(event: ParticipantClickEvent) {
    if (!isTrackReference(event.track) || event.track.source !== Track.Source.Camera) {
      return;
    }
    setPinnedTrack(event.track);
  }

  const filmstrip = carouselTracks.length > 0 ? (
    <div
      className={[
        styles.filmstrip,
        screenShareTrack ? styles.filmstripScreenShare : "",
        compact ? styles.filmstripCompact : "",
        screenShareTrack && compact ? styles.filmstripScreenShareCompact : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.filmstripRow} role="list">
        {carouselTracks.map((track) => (
          <ParticipantTile
            key={getTrackReferenceId(track)}
            trackRef={track}
            className={[
              styles.filmstripTile,
              screenShareTrack ? styles.filmstripTileScreenShare : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onParticipantClick={handleParticipantClick}
          />
        ))}
      </div>
    </div>
  ) : null;

  if (useGridLayout) {
    return (
      <div
        className={styles.participantGridStage}
        data-participant-count={String(cameraTracks.length)}
      >
        <GridLayout tracks={cameraTracks} className={styles.participantGrid}>
          <ParticipantTile
            className={styles.gridTile}
            onParticipantClick={handleParticipantClick}
          />
        </GridLayout>
      </div>
    );
  }

  if (screenShareTrack) {
    return (
      <div
        className={[
          styles.speakerLayout,
          styles.speakerLayoutScreenShare,
          compact ? styles.speakerLayoutCompact : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.shareBanner}>
          {screenShareTrack.participant.name ||
            screenShareTrack.participant.identity}{" "}
          демонстрирует экран
        </div>

        <div className={styles.speakerMainScreenShare}>
          <ParticipantTile
            trackRef={screenShareTrack}
            className={[styles.speakerMainTile, styles.speakerMainTileScreenShare]
              .filter(Boolean)
              .join(" ")}
          />
        </div>

        {filmstrip}
      </div>
    );
  }

  return (
    <div
      className={[
        styles.speakerLayout,
        compact ? styles.speakerLayoutCompact : "",
        styles.speakerLayoutStacked,
        localIsSharing ? styles.speakerLayoutLocalSharing : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {localIsSharing ? (
        <div className={styles.shareBanner}>
          Вы демонстрируете экран — себе превью не показывается, чтобы не было
          «зеркала»
        </div>
      ) : null}

      {filmstrip}

      <div className={styles.speakerMain}>
        {focusTrack ? (
          <ParticipantTile
            trackRef={focusTrack}
            className={styles.speakerMainTile}
          />
        ) : (
          <div className={styles.localSharePlaceholder}>
            Вы в эфире с демонстрацией экрана
          </div>
        )}
      </div>
    </div>
  );
}
