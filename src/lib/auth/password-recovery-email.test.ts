import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPasswordRecoveryEmailContent } from "./password-recovery-email-content";

describe("password recovery email content", () => {
  it("builds Russian subject and body with reset URL", () => {
    const content = buildPasswordRecoveryEmailContent({
      locale: "ru",
      resetUrl:
        "https://www.spiora.ai/auth/confirm/employee?token_hash=abc&type=recovery",
    });
    assert.match(content.subject, /Сброс пароля/);
    assert.match(content.text, /профиля Spiora/);
    assert.match(
      content.text,
      /https:\/\/www\.spiora\.ai\/auth\/confirm\/employee\?token_hash=abc&type=recovery/,
    );
  });

  it("builds English subject and body", () => {
    const content = buildPasswordRecoveryEmailContent({
      locale: "en",
      resetUrl: "https://example.com/reset",
    });
    assert.match(content.subject, /Reset your Spiora password/);
    assert.match(content.text, /https:\/\/example\.com\/reset/);
  });

  it("wraps reset URL in an HTML anchor for clickable mail clients", () => {
    const resetUrl =
      "https://www.spiora.ai/auth/confirm/client?token_hash=abc&type=recovery";
    const content = buildPasswordRecoveryEmailContent({
      locale: "ru",
      resetUrl,
    });
    assert.match(
      content.html,
      /<a href="https:\/\/www\.spiora\.ai\/auth\/confirm\/client\?token_hash=abc&amp;type=recovery">/,
    );
    assert.match(content.html, /&amp;type=recovery/);
    assert.doesNotMatch(content.html, /javascript:/i);
  });
});
