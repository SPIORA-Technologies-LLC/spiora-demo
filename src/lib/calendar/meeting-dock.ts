export const MEETING_DOCK_SESSION_KEY = "ss-meeting-dock-session";
export const MEETING_DOCK_NAVIGATE_KEY = "ss-meeting-dock-navigate";

export type MeetingDockSession = {
  eventId: string;
  title: string;
  openedAt: string;
};

export function getMeetingDockWindowName(eventId: string): string {
  return `ss-meeting-${eventId}`;
}

export function readMeetingDockSession(): MeetingDockSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(MEETING_DOCK_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as MeetingDockSession;
    if (!parsed.eventId || !parsed.title) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markMeetingDockActive(session: MeetingDockSession): void {
  sessionStorage.setItem(MEETING_DOCK_SESSION_KEY, JSON.stringify(session));
}

export function clearMeetingDockActive(): void {
  sessionStorage.removeItem(MEETING_DOCK_SESSION_KEY);
  sessionStorage.removeItem(MEETING_DOCK_NAVIGATE_KEY);
}

export function markMeetingDockNavigate(eventId: string): void {
  sessionStorage.setItem(MEETING_DOCK_NAVIGATE_KEY, eventId);
}

export function readMeetingDockNavigateEventId(): string | null {
  return sessionStorage.getItem(MEETING_DOCK_NAVIGATE_KEY);
}

export function clearMeetingDockNavigate(): void {
  sessionStorage.removeItem(MEETING_DOCK_NAVIGATE_KEY);
}

export function openMeetingDockWindow(eventId: string): Window | null {
  return window.open(
    `/calendar/meet/${encodeURIComponent(eventId)}?dock=1`,
    getMeetingDockWindowName(eventId),
    "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
  );
}

export function focusMeetingDockWindow(eventId: string): Window | null {
  const win = window.open(
    `/calendar/meet/${encodeURIComponent(eventId)}?dock=1`,
    getMeetingDockWindowName(eventId),
    "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
  );
  win?.focus();
  return win;
}

export function closeMeetingDockWindow(eventId: string): void {
  const win = window.open("", getMeetingDockWindowName(eventId));
  win?.close();
}

export function isMeetingDockMode(searchParams: URLSearchParams): boolean {
  return searchParams.get("dock") === "1";
}

export function isMeetingMinimizedMode(searchParams: URLSearchParams): boolean {
  return searchParams.get("minimized") === "1";
}

// --- Guest meeting dock (popup while browsing other tabs) ---

export const GUEST_MEETING_DOCK_SESSION_KEY = "ss-guest-meeting-dock-session";
export const GUEST_MEETING_DOCK_NAVIGATE_KEY = "ss-guest-meeting-dock-navigate";
export const GUEST_MEETING_DOCK_CREDENTIALS_KEY =
  "ss-guest-meeting-dock-credentials";

export type GuestMeetingDockSession = {
  inviteToken: string;
  title: string;
  openedAt: string;
};

export type GuestMeetingDockCredentials = {
  inviteToken: string;
  displayName: string;
  guestId: string;
  accessPassword?: string;
  admissionId?: string;
};

export function getGuestMeetingDockWindowName(inviteToken: string): string {
  return `ss-guest-meeting-${inviteToken.slice(0, 24)}`;
}

export function readGuestMeetingDockSession(): GuestMeetingDockSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(GUEST_MEETING_DOCK_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GuestMeetingDockSession;
    if (!parsed.inviteToken || !parsed.title) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markGuestMeetingDockActive(
  session: GuestMeetingDockSession,
): void {
  sessionStorage.setItem(
    GUEST_MEETING_DOCK_SESSION_KEY,
    JSON.stringify(session),
  );
}

export function clearGuestMeetingDockActive(): void {
  sessionStorage.removeItem(GUEST_MEETING_DOCK_SESSION_KEY);
  sessionStorage.removeItem(GUEST_MEETING_DOCK_NAVIGATE_KEY);
  sessionStorage.removeItem(GUEST_MEETING_DOCK_CREDENTIALS_KEY);
}

export function markGuestMeetingDockCredentials(
  credentials: GuestMeetingDockCredentials,
): void {
  sessionStorage.setItem(
    GUEST_MEETING_DOCK_CREDENTIALS_KEY,
    JSON.stringify(credentials),
  );
}

export function readGuestMeetingDockCredentials(): GuestMeetingDockCredentials | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(GUEST_MEETING_DOCK_CREDENTIALS_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GuestMeetingDockCredentials;
    if (!parsed.inviteToken || !parsed.displayName || !parsed.guestId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markGuestMeetingDockNavigate(inviteToken: string): void {
  sessionStorage.setItem(GUEST_MEETING_DOCK_NAVIGATE_KEY, inviteToken);
}

export function readGuestMeetingDockNavigateToken(): string | null {
  return sessionStorage.getItem(GUEST_MEETING_DOCK_NAVIGATE_KEY);
}

export function clearGuestMeetingDockNavigate(): void {
  sessionStorage.removeItem(GUEST_MEETING_DOCK_NAVIGATE_KEY);
}

export function openGuestMeetingDockWindow(inviteToken: string): Window | null {
  return window.open(
    `/join/${encodeURIComponent(inviteToken)}?dock=1`,
    getGuestMeetingDockWindowName(inviteToken),
    "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
  );
}

export function focusGuestMeetingDockWindow(inviteToken: string): Window | null {
  const win = window.open(
    `/join/${encodeURIComponent(inviteToken)}?dock=1`,
    getGuestMeetingDockWindowName(inviteToken),
    "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
  );
  win?.focus();
  return win;
}

export function closeGuestMeetingDockWindow(inviteToken: string): void {
  const win = window.open("", getGuestMeetingDockWindowName(inviteToken));
  win?.close();
}
