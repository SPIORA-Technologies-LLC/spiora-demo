"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { branding } from "@/config/branding";
import { formatEventTimeRange } from "@/lib/calendar/format";
import { CALENDAR_TIMEZONE } from "@/lib/calendar/constants";
import type { CalendarEvent } from "@/lib/calendar/types";
import {
  clearGuestMeetingDockActive,
  clearGuestMeetingDockNavigate,
  isMeetingDockMode,
  isMeetingMinimizedMode,
  markGuestMeetingDockActive,
  markGuestMeetingDockCredentials,
  markGuestMeetingDockNavigate,
  openGuestMeetingDockWindow,
  readGuestMeetingDockCredentials,
  readGuestMeetingDockNavigateToken,
  readGuestMeetingDockSession,
} from "@/lib/calendar/meeting-dock";
import { GuestMeetingGate } from "./GuestMeetingGate";
import { GuestMeetingDockGate } from "./GuestMeetingDockGate";
import { GuestMeetingMinimizedView } from "./GuestMeetingMinimizedView";
import { MeetingBackgroundProvider } from "./MeetingBackgroundContext";
import { MeetingControlBar } from "./MeetingControlBar";
import { MeetingParticipantPanel } from "./MeetingParticipantPanel";
import { MeetingRecordingNotice } from "./MeetingRecordingNotice";
import { MeetingSpeakerLayout } from "./MeetingSpeakerLayout";
import { MEETING_ROOM_OPTIONS } from "@/lib/calendar/meeting-room-options";
import meetStyles from "./CalendarMeetRoom.module.css";
import styles from "./GuestMeetRoom.module.css";

type GuestTokenPayload = {
  wsUrl: string;
  token: string;
  roomName: string;
  expiresAt: string;
  guestId: string;
  eventTitle: string;
};

type AdmissionPayload = {
  admissionId: string;
  guestId: string;
  status: "pending";
  waitingRoom: boolean;
};

type ConnectState =
  | { status: "lobby" }
  | { status: "loading" }
  | {
      status: "waiting";
      displayName: string;
      admissionId: string;
      guestId: string;
    }
  | {
      status: "ready";
      credentials: GuestTokenPayload;
      displayName: string;
      admissionId?: string;
    }
  | { status: "error"; message: string }
  | { status: "left" }
  | { status: "rejected" };

async function postGuestAudit(
  inviteToken: string,
  guestId: string,
  displayName: string,
  action: "joined" | "left",
  options?: { keepalive?: boolean },
): Promise<void> {
  await fetch("/api/meet/guest-audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteToken, guestId, displayName, action }),
    keepalive: options?.keepalive ?? false,
  });
}

async function fetchGuestToken(
  inviteToken: string,
  displayName: string,
  accessPassword: string,
  admission?: { admissionId: string; guestId: string },
): Promise<GuestTokenPayload> {
  const response = await fetch("/api/meet/guest-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inviteToken,
      displayName,
      accessPassword: accessPassword || undefined,
      admissionId: admission?.admissionId,
      guestId: admission?.guestId,
    }),
  });

  const payload = (await response.json()) as GuestTokenPayload & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Не удалось подключиться");
  }

  return payload;
}

type GuestMeetingStageProps = {
  event: CalendarEvent;
  inviteToken: string;
  displayName: string;
  guestId: string;
  isDockMode: boolean;
  onLeave: () => void;
  onMinimize: () => void;
};

function GuestMeetingStage({
  event,
  inviteToken,
  displayName,
  guestId,
  isDockMode,
  onLeave,
  onMinimize,
}: GuestMeetingStageProps) {
  const room = useRoomContext();
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const participants = useParticipants();

  const leaveMeeting = useCallback(async () => {
    room.disconnect();
    onLeave();
  }, [onLeave, room]);

  return (
    <div className={styles.room}>
      <div className={styles.overlayChrome}>
        <div className={styles.overlayLeft}>
          {isDockMode ? (
            <span className={meetStyles.dockBadge}>Окно встречи</span>
          ) : (
            <span className={styles.guestBadge} title={event.title}>
              Гость
            </span>
          )}
        </div>
        <MeetingRecordingNotice inviteToken={inviteToken} />
        <div className={styles.overlayRight}>
          {!isDockMode ? (
            <button
              type="button"
              className={meetStyles.overlayPlatform}
              onClick={onMinimize}
              title="Свернуть встречу в отдельное окно и открыть другие вкладки"
              aria-label="Свернуть встречу"
            >
              <i className="fa-solid fa-window-restore" aria-hidden="true" />
            </button>
          ) : null}
          <span className={styles.guestName}>{displayName}</span>
        </div>
      </div>

      {isDockMode ? (
        <div className={meetStyles.dockHint}>
          Встреча в отдельном окне. Откройте нужный сайт в другой вкладке — звонок
          продолжится здесь.
        </div>
      ) : null}

      <div className={meetStyles.stage}>
        <MeetingSpeakerLayout compact={isDockMode} />
      </div>

      <MeetingControlBar
        participantCount={participants.length}
        participantsOpen={participantsOpen}
        onToggleParticipants={() => setParticipantsOpen((open) => !open)}
        onLeave={leaveMeeting}
        compact={isDockMode}
      />

      {participantsOpen ? (
        <MeetingParticipantPanel onClose={() => setParticipantsOpen(false)} />
      ) : null}

      <RoomAudioRenderer />

      <GuestAuditReporter
        inviteToken={inviteToken}
        guestId={guestId}
        displayName={displayName}
      />
    </div>
  );
}

function GuestAuditReporter({
  inviteToken,
  guestId,
  displayName,
}: {
  inviteToken: string;
  guestId: string;
  displayName: string;
}) {
  useEffect(() => {
    void postGuestAudit(inviteToken, guestId, displayName, "joined");

    function onBeforeUnload() {
      void postGuestAudit(inviteToken, guestId, displayName, "left", {
        keepalive: true,
      });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [displayName, guestId, inviteToken]);

  return null;
}

type GuestMeetRoomProps = {
  event: CalendarEvent;
  inviteToken: string;
  requiresGuestPassword?: boolean;
};

export function GuestMeetRoom({
  event,
  inviteToken,
  requiresGuestPassword = false,
}: GuestMeetRoomProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDockMode = isMeetingDockMode(searchParams);
  const isMinimizedMode = isMeetingMinimizedMode(searchParams);
  const [bypassDockGate, setBypassDockGate] = useState(false);
  const [dockChecked, setDockChecked] = useState(false);
  const [dockSession, setDockSession] = useState(
    null as ReturnType<typeof readGuestMeetingDockSession>,
  );
  const [displayName, setDisplayName] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [connectState, setConnectState] = useState<ConnectState>({
    status: "lobby",
  });
  const dockAutoConnectStartedRef = useRef(false);

  useEffect(() => {
    setDockSession(readGuestMeetingDockSession());
    setDockChecked(true);
  }, []);

  const showDockGate =
    dockChecked &&
    !isDockMode &&
    !isMinimizedMode &&
    !bypassDockGate &&
    dockSession?.inviteToken === inviteToken;

  const connectWithToken = useCallback(
    async (
      trimmed: string,
      password: string,
      admission?: { admissionId: string; guestId: string },
    ) => {
      const payload = await fetchGuestToken(
        inviteToken,
        trimmed,
        password,
        admission,
      );
      setConnectState({
        status: "ready",
        credentials: payload,
        displayName: trimmed,
        admissionId: admission?.admissionId,
      });
    },
    [inviteToken],
  );

  useEffect(() => {
    if (!isDockMode || connectState.status !== "lobby" || dockAutoConnectStartedRef.current) {
      return;
    }

    dockAutoConnectStartedRef.current = true;
    const stored = readGuestMeetingDockCredentials();
    if (!stored || stored.inviteToken !== inviteToken) {
      setConnectState({
        status: "error",
        message: "Не удалось восстановить подключение. Откройте ссылку заново.",
      });
      return;
    }

    setDisplayName(stored.displayName);
    setConnectState({ status: "loading" });
    void connectWithToken(
      stored.displayName,
      stored.accessPassword ?? "",
      stored.admissionId && stored.guestId
        ? { admissionId: stored.admissionId, guestId: stored.guestId }
        : undefined,
    ).catch((error) => {
      setConnectState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подключиться в окне встречи",
      });
    });
  }, [connectState.status, connectWithToken, inviteToken, isDockMode]);

  const handleJoin = useCallback(async () => {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      return;
    }
    if (requiresGuestPassword && accessPassword.trim().length < 1) {
      return;
    }

    setConnectState({ status: "loading" });

    try {
      if (event.guestWaitingRoom) {
        const response = await fetch("/api/meet/guest-admission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviteToken,
            displayName: trimmed,
            accessPassword: accessPassword || undefined,
          }),
        });
        const payload = (await response.json()) as AdmissionPayload & {
          error?: string;
        };

        if (!response.ok) {
          setConnectState({
            status: "error",
            message: payload.error ?? "Не удалось отправить запрос",
          });
          return;
        }

        setConnectState({
          status: "waiting",
          displayName: trimmed,
          admissionId: payload.admissionId,
          guestId: payload.guestId,
        });
        return;
      }

      await connectWithToken(trimmed, accessPassword);
    } catch (error) {
      setConnectState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Не удалось подключиться. Проверьте интернет и попробуйте снова.",
      });
    }
  }, [accessPassword, connectWithToken, displayName, event.guestWaitingRoom, inviteToken, requiresGuestPassword]);

  useEffect(() => {
    if (connectState.status !== "waiting") {
      return;
    }

    const { admissionId, guestId, displayName: waitingName } = connectState;
    let cancelled = false;

    async function pollAdmission() {
      try {
        const response = await fetch(
          `/api/meet/guest-admission/${encodeURIComponent(admissionId)}?inviteToken=${encodeURIComponent(inviteToken)}`,
        );
        const payload = (await response.json()) as {
          status?: string;
          error?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setConnectState({
            status: "error",
            message: payload.error ?? "Не удалось проверить статус",
          });
          return;
        }

        if (payload.status === "admitted") {
          await connectWithToken(waitingName, accessPassword, {
            admissionId,
            guestId,
          });
          return;
        }

        if (payload.status === "rejected") {
          setConnectState({ status: "rejected" });
        }
      } catch {
        if (!cancelled) {
          setConnectState({
            status: "error",
            message: "Не удалось проверить статус подключения",
          });
        }
      }
    }

    void pollAdmission();
    const intervalId = window.setInterval(() => {
      void pollAdmission();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [accessPassword, connectState, connectWithToken, inviteToken]);

  const handleLeave = useCallback(() => {
    if (connectState.status === "ready") {
      void postGuestAudit(
        inviteToken,
        connectState.credentials.guestId,
        connectState.displayName,
        "left",
      );
    }
    clearGuestMeetingDockActive();
    setConnectState({ status: "left" });
  }, [connectState, inviteToken]);

  const handleDisconnected = useCallback(() => {
    if (readGuestMeetingDockNavigateToken() === inviteToken) {
      clearGuestMeetingDockNavigate();
      router.replace(`/join/${encodeURIComponent(inviteToken)}?minimized=1`);
      return;
    }

    handleLeave();
  }, [handleLeave, inviteToken, router]);

  const handleMinimize = useCallback(() => {
    if (connectState.status !== "ready") {
      return;
    }

    markGuestMeetingDockCredentials({
      inviteToken,
      displayName: connectState.displayName,
      guestId: connectState.credentials.guestId,
      accessPassword: accessPassword || undefined,
      admissionId: connectState.admissionId,
    });

    const popup = openGuestMeetingDockWindow(inviteToken);
    if (!popup) {
      window.alert(
        "Не удалось открыть окно встречи. Разрешите всплывающие окна для сайта и попробуйте снова.",
      );
      return;
    }

    markGuestMeetingDockActive({
      inviteToken,
      title: event.title,
      openedAt: new Date().toISOString(),
    });
    markGuestMeetingDockNavigate(inviteToken);
    router.replace(`/join/${encodeURIComponent(inviteToken)}?minimized=1`);
  }, [accessPassword, connectState, event.title, inviteToken, router]);

  if (isMinimizedMode && dockSession?.inviteToken === inviteToken) {
    return (
      <GuestMeetingMinimizedView event={event} inviteToken={inviteToken} />
    );
  }

  if (connectState.status === "left") {
    return <GuestMeetingGate variant="left" event={event} />;
  }

  if (connectState.status === "rejected") {
    return <GuestMeetingGate variant="rejected" event={event} />;
  }

  if (connectState.status === "waiting") {
    return <GuestMeetingGate variant="waiting_room" event={event} />;
  }

  if (!dockChecked) {
    return (
      <div className={styles.lobbyPage}>
        <div className={styles.lobbyCard}>
          <p>{branding.productName}</p>
        </div>
      </div>
    );
  }

  if (showDockGate) {
    return (
      <div className={styles.lobbyPage}>
        <GuestMeetingDockGate
          inviteToken={inviteToken}
          eventTitle={event.title}
          onConnectHere={() => setBypassDockGate(true)}
        />
      </div>
    );
  }

  if (
    connectState.status === "lobby" ||
    connectState.status === "loading" ||
    connectState.status === "error"
  ) {
    if (isDockMode && connectState.status === "lobby") {
      return (
        <div className={styles.lobbyPage}>
          <div className={styles.lobbyCard}>
            <p className={styles.lobbyTitle}>Подключение…</p>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.lobbyPage}>
        <div className={styles.lobbyCard}>
          <p className={styles.lobbyBrand}>{branding.productName}</p>
          <h1 className={styles.lobbyTitle}>Видеовстреча</h1>
          <p className={styles.lobbyEventTitle}>{event.title}</p>
          <p className={styles.lobbyEventTime}>
            {formatEventTimeRange(event, CALENDAR_TIMEZONE)}
          </p>

          {event.guestWaitingRoom ? (
            <p className={styles.waitingHint}>
              После отправки запроса организатор должен принять вас в зал ожидания.
            </p>
          ) : null}

          {requiresGuestPassword ? (
            <>
              <label className={styles.nameLabel} htmlFor="guest-access-password">
                Пароль встречи
              </label>
              <input
                id="guest-access-password"
                type="password"
                className={styles.nameInput}
                value={accessPassword}
                onChange={(event) => setAccessPassword(event.target.value)}
                placeholder="Пароль от организатора"
                autoComplete="current-password"
                disabled={connectState.status === "loading"}
              />
            </>
          ) : null}

          <label className={styles.nameLabel} htmlFor="guest-display-name">
            Ваше имя
          </label>
          <input
            id="guest-display-name"
            className={styles.nameInput}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Как вас представить участникам"
            maxLength={80}
            autoComplete="name"
            disabled={connectState.status === "loading"}
          />

          {connectState.status === "error" ? (
            <p className={styles.error}>{connectState.message}</p>
          ) : null}

          <button
            type="button"
            className={styles.joinButton}
            onClick={() => void handleJoin()}
            disabled={
              connectState.status === "loading" ||
              displayName.trim().length < 2 ||
              (requiresGuestPassword && accessPassword.trim().length < 1)
            }
          >
            {connectState.status === "loading"
              ? "Подключение…"
              : event.guestWaitingRoom
                ? "Запросить вход"
                : "Присоединиться"}
          </button>
        </div>
      </div>
    );
  }

  const { credentials } = connectState;

  return (
    <div
      className={[
        styles.page,
        isDockMode ? meetStyles.pageDock : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <LiveKitRoom
        serverUrl={credentials.wsUrl}
        token={credentials.token}
        connect
        audio
        video
        options={MEETING_ROOM_OPTIONS}
        onDisconnected={handleDisconnected}
        className={styles.livekitRoom}
        data-ss-meeting-room="true"
      >
        <MeetingBackgroundProvider>
          <GuestMeetingStage
            event={event}
            inviteToken={inviteToken}
            displayName={connectState.displayName}
            guestId={credentials.guestId}
            isDockMode={isDockMode}
            onLeave={handleLeave}
            onMinimize={handleMinimize}
          />
        </MeetingBackgroundProvider>
      </LiveKitRoom>
    </div>
  );
}
