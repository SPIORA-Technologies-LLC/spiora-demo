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
  const [filmstripOpen, setFilmstripOpen] = useState(true);

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

  useEffect(() => {
    if (cameraTracks.length > 0) {
      setFilmstripOpen(true);
    }
  }, [cameraTracks.length]);

  const useGridLayout =
    !screenShareTrack &&
    !localIsSharing &&
    cameraTracks.length > 0 &&
    cameraTracks.length <= MEETING_GRID_MAX_PARTICIPANTS;

  const focusTrack = useMemo(
    () =>
      useGridLayout || localIsSharing
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
      localIsSharing,
      localParticipant.identity,
      pinnedTrack,
      screenShareTrack,
      useGridLayout,
    ],
  );

  const carouselTracks = useMemo(() => {
    if (localIsSharing || screenShareTrack) {
      return cameraTracks;
    }
    return resolveSpeakerCarouselTracks(cameraTracks, focusTrack);
  }, [cameraTracks, focusTrack, localIsSharing, screenShareTrack]);

  function handleParticipantClick(event: ParticipantClickEvent) {
    if (!isTrackReference(event.track) || event.track.source !== Track.Source.Camera) {
      return;
    }
    setPinnedTrack(event.track);
  }

  function renderFilmstripToggle() {
    if (carouselTracks.length === 0) {
      return null;
    }

    return (
      <button
        type="button"
        className={styles.filmstripToggle}
        onClick={() => setFilmstripOpen((open) => !open)}
        aria-expanded={filmstripOpen}
        aria-label={
          filmstripOpen ? "Скрыть видео участников" : "Показать видео участников"
        }
      >
        {filmstripOpen ? "Скрыть видео" : "Показать видео"}
      </button>
    );
  }

  const filmstrip =
    carouselTracks.length > 0 && filmstripOpen ? (
      <div
        className={[
          styles.filmstrip,
          screenShareTrack || localIsSharing ? styles.filmstripScreenShare : "",
          localIsSharing ? styles.filmstripScreenShareTop : "",
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
                screenShareTrack || localIsSharing
                  ? styles.filmstripTileScreenShare
                  : "",
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
          <span>
            {screenShareTrack.participant.name ||
              screenShareTrack.participant.identity}{" "}
            демонстрирует экран
          </span>
          {renderFilmstripToggle()}
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

  if (localIsSharing) {
    return (
      <div
        className={[
          styles.speakerLayout,
          compact ? styles.speakerLayoutCompact : "",
          styles.speakerLayoutStacked,
          styles.speakerLayoutLocalSharing,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className={styles.shareBanner}>
          <span>
            Вы демонстрируете экран — участники видны в окошках сверху
          </span>
          {renderFilmstripToggle()}
        </div>

        {filmstrip}

        <div className={styles.speakerMain}>
          <div className={styles.localSharePlaceholder}>
            Вы в эфире с демонстрацией экрана
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        styles.speakerLayout,
        compact ? styles.speakerLayoutCompact : "",
        styles.speakerLayoutStacked,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {filmstrip}

      <div className={styles.speakerMain}>
        {focusTrack ? (
          <ParticipantTile
            trackRef={focusTrack}
            className={styles.speakerMainTile}
          />
        ) : (
          <div className={styles.localSharePlaceholder}>Ожидание участников…</div>
        )}
      </div>
    </div>
  );
}
