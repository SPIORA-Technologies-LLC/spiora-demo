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
    assert.match(content.text, /временный пароль/);
    assert.match(
      content.html,
      /<a href="https:\/\/spiora\.demo\/client\/invite\/token" target="_blank" rel="noopener noreferrer">/,
    );
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
    assert.match(content.text, /temporary password/i);
    assert.match(content.html, /NewPass99/);
    assert.match(
      content.html,
      /<a href="https:\/\/spiora\.demo\/client\/login" target="_blank" rel="noopener noreferrer">/,
    );
  });

  it("builds existing-account invite without rotating password copy", () => {
    const content = buildClientInviteEmailContent({
      email: "client@example.com",
      inviteUrl: "https://spiora.demo/client/invite/token",
      loginUrl: "https://spiora.demo/client/login",
      locale: "en",
      kind: "invite_existing",
    });

    assert.match(content.subject, /account/i);
    assert.match(content.text, /already exists/i);
    assert.match(content.text, /Forgot password/);
    assert.doesNotMatch(content.text, /Password:/);
    assert.match(
      content.html,
      /<a href="https:\/\/spiora\.demo\/client\/login"/,
    );
  });
});
