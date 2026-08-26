import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemNotifyFromItem } from "./system-notify.ts";

describe("buildSystemNotifyFromItem", () => {
  it("uses author as title for team chat previews", () => {
    const payload = buildSystemNotifyFromItem(
      {
        id: "n1",
        user_id: "u1",
        type: "team_chat",
        title: "New message",
        message: "Can someone cover the follow-up?",
        author_name: "Emma Wilson",
        is_read: false,
        created_at: "2026-08-26T12:00:00.000Z",
      },
      "/team-chat",
    );

    assert.equal(payload.title, "Emma Wilson");
    assert.equal(payload.body, "Can someone cover the follow-up?");
    assert.equal(payload.href, "/team-chat");
    assert.ok((payload.autoCloseMs ?? 0) > 0);
  });
});
