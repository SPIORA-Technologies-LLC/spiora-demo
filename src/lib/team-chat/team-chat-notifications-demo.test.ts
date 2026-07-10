import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  translateDemoNotificationMessage,
  translateDemoNotificationTitle,
  translateNotificationEmit,
  translateTeamChatPreview,
  getDemoNotificationType,
} from "@/i18n/notification-emit-messages.ts";
import { encodeDemoNavMessage } from "@/lib/notifications/notification-demo-nav.ts";
import {
  getNotificationDisplayMessage,
  getNotificationHref,
  getNotificationSection,
} from "@/lib/notifications/navigation.ts";
import {
  buildDemoNotificationsForUser,
  DEMO_NOTIFICATION_COUNT,
} from "@/lib/demo/demo-notifications.ts";
import {
  DEMO_TEAM_CHAT_MESSAGE_COUNT,
  buildDemoTeamChatMessages,
} from "@/lib/team-chat/demo-messages.ts";
import { resolveDemoMessageText } from "@/lib/team-chat/demo-message-text.ts";
import {
  checkTeamChatDemoActionRateLimit,
  DEMO_MAX_MESSAGES_PER_MINUTE,
  resetTeamChatDemoRateLimitsForTests,
} from "@/lib/team-chat/demo-rate-limit.ts";
import { buildMessagePreview } from "@/lib/team-chat/message-preview.ts";
import type { TeamChatMessage } from "@/lib/team-chat/types.ts";

describe("team chat demo messages", () => {
  it("seeds 27 localized demo messages", () => {
    assert.equal(DEMO_TEAM_CHAT_MESSAGE_COUNT, 27);
    const messages = buildDemoTeamChatMessages();
    assert.equal(messages.length, 27);
    assert.match(messages[0].message_text, /^demo:/);
  });

  it("EN: resolves demo message text without Cyrillic", () => {
    const text = resolveDemoMessageText("en", "demo:mondayStandup");
    assert.doesNotMatch(text, /[А-Яа-яЁё]/);
    assert.match(text, /standup|morning/i);
  });

  it("RU: resolves demo message text in Russian", () => {
    const text = resolveDemoMessageText("ru", "demo:pipelineMoved");
    assert.match(text, /[А-Яа-яЁё]/);
    assert.match(text, /Sofia Martins/);
  });
});

describe("demo notifications", () => {
  it("builds 12 demo notifications", () => {
    assert.equal(DEMO_NOTIFICATION_COUNT, 12);
    const items = buildDemoNotificationsForUser("demo-user", "en");
    assert.equal(items.length, 12);
    assert.ok(items.some((item) => item.type === "team_chat"));
    assert.ok(items.some((item) => item.type === "system"));
  });

  it("EN: demo notification titles without Cyrillic", () => {
    const title = translateDemoNotificationTitle("en", "aiSummaryReady");
    assert.doesNotMatch(title, /[А-Яа-яЁё]/);
    assert.match(title, /AI summary/i);
  });

  it("RU: demo notification message in Russian with preserved names", () => {
    const message = translateDemoNotificationMessage("ru", "messageFromEmma");
    assert.match(message, /[А-Яа-яЁё]/);
    assert.match(message, /Emma Wilson/);
  });

  it("demo deep links route to demo paths only", () => {
    const items = buildDemoNotificationsForUser("demo-user", "en");
    const ai = items.find((item) => item.title.includes("AI summary"));
    assert.ok(ai);
    assert.equal(getNotificationHref(ai!.type, ai!.message), "/ai-workspace");

    const client = items.find((item) =>
      getNotificationHref(item.type, item.message)?.startsWith("/clients/DEMO-"),
    );
    assert.ok(client);
  });

  it("demo payload avoids production storage paths", () => {
    const items = buildDemoNotificationsForUser("demo-user", "en");
    const serialized = JSON.stringify(items);
    assert.doesNotMatch(serialized, /supabase|storage\/v1|\.data\//i);
  });
});

describe("notification emit translations", () => {
  it("EN: team chat preview labels", () => {
    assert.equal(
      translateTeamChatPreview("en", "voice"),
      translateNotificationEmit("en", "teamChatPreview.voice"),
    );
    assert.doesNotMatch(translateTeamChatPreview("en", "voice"), /[А-Яа-яЁё]/);
  });

  it("maps demo notification template types", () => {
    assert.equal(getDemoNotificationType("teamMeetingSoon"), "calendar_reminder");
    assert.equal(getDemoNotificationType("aiSummaryReady"), "system");
  });
});

describe("notification demo nav", () => {
  it("decodes display text and href", () => {
    const message = encodeDemoNavMessage(
      "AI summary is ready",
      "/ai-workspace",
    );
    assert.equal(
      getNotificationDisplayMessage("system", message),
      "AI summary is ready",
    );
    assert.equal(getNotificationHref("system", message), "/ai-workspace");
    assert.equal(
      getNotificationSection("system", message),
      "ai-workspace",
    );
  });
});

describe("team chat demo rate limits", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup, SPIORA_DEMO_MODE: "true" };
    resetTeamChatDemoRateLimitsForTests();
  });

  afterEach(() => {
    process.env = { ...envBackup };
    resetTeamChatDemoRateLimitsForTests();
  });

  it("blocks excessive sends in demo mode", () => {
    for (let i = 0; i < DEMO_MAX_MESSAGES_PER_MINUTE; i += 1) {
      assert.equal(
        checkTeamChatDemoActionRateLimit("user-1", "send", 10).allowed,
        true,
      );
    }
    const blocked = checkTeamChatDemoActionRateLimit("user-1", "send", 10);
    assert.equal(blocked.allowed, false);
    if (!blocked.allowed) {
      assert.equal(blocked.reason, "minute");
    }
  });

  it("ignores limits outside demo mode", () => {
    delete process.env.SPIORA_DEMO_MODE;
    for (let i = 0; i < DEMO_MAX_MESSAGES_PER_MINUTE + 5; i += 1) {
      assert.equal(
        checkTeamChatDemoActionRateLimit("user-1", "send", 10).allowed,
        true,
      );
    }
  });
});

describe("message preview locale", () => {
  const base: TeamChatMessage = {
    id: "1",
    user_id: "u1",
    user_name: "Olivia Bennett",
    user_role: "owner",
    message_type: "text",
    message_text: "demo:mondayStandup",
    audio_url: null,
    audio_duration_ms: null,
    image_url: null,
    file_url: null,
    file_name: null,
    file_content_type: null,
    file_size: null,
    reply_to_message_id: null,
    reply_to_user_name: null,
    reply_to_message_type: null,
    reply_to_preview: null,
    is_pinned: false,
    pinned_at: null,
    pinned_by_user_id: null,
    created_at: "2026-07-10T07:00:00.000Z",
    updated_at: "2026-07-10T07:00:00.000Z",
  };

  it("EN: voice label without Cyrillic", () => {
    const preview = buildMessagePreview(
      { ...base, message_type: "voice", message_text: "" },
      "en",
    );
    assert.doesNotMatch(preview, /[А-Яа-яЁё]/);
  });

  it("RU: resolves demo text in preview", () => {
    const preview = buildMessagePreview(base, "ru");
    assert.match(preview, /[А-Яа-яЁё]/);
  });
});
