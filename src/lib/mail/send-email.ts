import "server-only";

import {
  defaultTransactionalEmailHtml,
  wrapTransactionalEmailHtml,
} from "./branded-html";
import { getMailConfig } from "./config";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; code: "EMAIL_NOT_CONFIGURED" | "EMAIL_SEND_FAILED" };

/**
 * Sends transactional email via Brevo (Sendinblue) HTTP API.
 * Docs: https://developers.brevo.com/reference/sendtransacemail
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = getMailConfig();
  if (!config.enabled) {
    return { ok: false, code: "EMAIL_NOT_CONFIGURED" };
  }

  const to = input.to.trim().toLowerCase();
  if (!to || !input.subject.trim() || !input.text.trim()) {
    return { ok: false, code: "EMAIL_SEND_FAILED" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: config.fromName,
          email: config.fromEmail,
        },
        to: [{ email: to }],
        subject: input.subject.trim(),
        textContent: input.text,
        htmlContent: input.html
          ? wrapTransactionalEmailHtml(input.html)
          : defaultTransactionalEmailHtml(input.text),
      }),
    });

    if (!response.ok) {
      return { ok: false, code: "EMAIL_SEND_FAILED" };
    }

    const data = (await response.json()) as { messageId?: string };
    return {
      ok: true,
      id: typeof data.messageId === "string" ? data.messageId : null,
    };
  } catch {
    return { ok: false, code: "EMAIL_SEND_FAILED" };
  }
}
