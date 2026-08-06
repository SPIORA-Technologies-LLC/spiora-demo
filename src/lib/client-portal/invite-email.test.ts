import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientInviteEmailContent } from "./invite-email";

describe("buildClientInviteEmailContent", () => {
  it("builds RU invite package with credentials", () => {
    const content = buildClientInviteEmailContent({
      email: "client@example.com",
      inviteUrl: "https://spiora.demo/client/invite/token",
      temporaryPassword: "TempPass12",
      locale: "ru",
      kind: "invite",
      firstName: "Анна",
    });

    assert.match(content.subject, /Spiora Client/);
    assert.match(content.text, /client@example\.com/);
    assert.match(content.text, /TempPass12/);
    assert.match(content.text, /https:\/\/spiora\.demo\/client\/invite\/token/);
    assert.match(content.text, /Здравствуйте/);
  });

  it("builds EN password-reset subject", () => {
    const content = buildClientInviteEmailContent({
      email: "client@example.com",
      inviteUrl: "https://spiora.demo/client/login",
      temporaryPassword: "NewPass99",
      locale: "en",
      kind: "password_reset",
    });

    assert.match(content.subject, /password/i);
    assert.match(content.text, /NewPass99/);
    assert.match(content.html, /NewPass99/);
  });
});
