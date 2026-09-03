import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  focusGuestMeetingDockWindow,
  focusMeetingDockWindow,
  getMeetingDockWindowName,
  getGuestMeetingDockWindowName,
  isMeetingDockMode,
  isMeetingMinimizedMode,
  markGuestMeetingDockActive,
  markMeetingDockActive,
  readGuestMeetingDockSession,
  readMeetingDockSession,
} from "./meeting-dock";

describe("meeting dock helpers", () => {
  it("builds stable popup window names", () => {
    assert.equal(getMeetingDockWindowName("evt-1"), "ss-meeting-evt-1");
  });

  it("detects dock query param", () => {
    assert.equal(
      isMeetingDockMode(new URLSearchParams("dock=1")),
      true,
    );
    assert.equal(isMeetingDockMode(new URLSearchParams()), false);
  });

  it("round-trips dock session metadata in sessionStorage", () => {
    const storage = new Map<string, string>();
    const original = globalThis.sessionStorage;
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });

    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    try {
      markMeetingDockActive({
        eventId: "evt-42",
        title: "Синк",
        openedAt: "2026-06-25T10:00:00.000Z",
      });

      assert.deepEqual(readMeetingDockSession(), {
        eventId: "evt-42",
        title: "Синк",
        openedAt: "2026-06-25T10:00:00.000Z",
      });
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: original,
      });
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("detects minimized query param", () => {
    assert.equal(
      isMeetingMinimizedMode(new URLSearchParams("minimized=1")),
      true,
    );
    assert.equal(isMeetingMinimizedMode(new URLSearchParams()), false);
  });

  it("builds stable guest popup window names", () => {
    assert.equal(
      getGuestMeetingDockWindowName("invite-token-abc"),
      "ss-guest-meeting-invite-token-abc",
    );
  });

  it("reopens meeting dock window with the meeting URL", () => {
    const originalWindow = globalThis.window;
    let call: { url?: string; name?: string; features?: string } | null = null;
    const popup = { focus() {} };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        open(url?: string, name?: string, features?: string) {
          call = { url, name, features };
          return popup;
        },
      },
    });

    try {
      const result = focusMeetingDockWindow("evt-42");
      assert.equal(result, popup);
      assert.deepEqual(call, {
        url: "/calendar/meet/evt-42?dock=1",
        name: "ss-meeting-evt-42",
        features: "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("reopens guest dock window with the join URL", () => {
    const originalWindow = globalThis.window;
    let call: { url?: string; name?: string; features?: string } | null = null;
    const popup = { focus() {} };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        open(url?: string, name?: string, features?: string) {
          call = { url, name, features };
          return popup;
        },
      },
    });

    try {
      const result = focusGuestMeetingDockWindow("invite-token-abc");
      assert.equal(result, popup);
      assert.deepEqual(call, {
        url: "/join/invite-token-abc?dock=1",
        name: "ss-guest-meeting-invite-token-abc",
        features: "popup=yes,width=420,height=760,resizable=yes,scrollbars=no",
      });
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("round-trips guest dock session metadata in sessionStorage", () => {
    const storage = new Map<string, string>();
    const original = globalThis.sessionStorage;
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: globalThis,
    });

    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    try {
      markGuestMeetingDockActive({
        inviteToken: "tok-guest",
        title: "Созвон",
        openedAt: "2026-06-25T10:00:00.000Z",
      });

      assert.deepEqual(readGuestMeetingDockSession(), {
        inviteToken: "tok-guest",
        title: "Созвон",
        openedAt: "2026-06-25T10:00:00.000Z",
      });
    } finally {
      Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: original,
      });
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
