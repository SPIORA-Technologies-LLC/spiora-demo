import type { AppLocale } from "@/i18n/config";
import { parseLocale } from "@/i18n/config";
import { getNestedMessage, getMessagesForLocale } from "@/i18n/messages";

function message(
  locale: AppLocale,
  keyPath: string,
  values?: Record<string, string>,
): string {
  const raw =
    getNestedMessage(getMessagesForLocale(locale), keyPath) ??
    getNestedMessage(getMessagesForLocale("en"), keyPath) ??
    keyPath;
  if (!values) return raw;
  let result = raw;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isHttpResetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function buildPasswordRecoveryEmailContent(input: {
  resetUrl: string;
  locale: AppLocale | string;
}): { subject: string; text: string; html: string } {
  const locale = parseLocale(input.locale);
  const subject = message(locale, "authPassword.email.subject");
  const text = message(locale, "authPassword.email.body", {
    resetUrl: input.resetUrl,
  });

  // Plain text keeps the raw URL; HTML must use a real <a> so clients like Yahoo
  // make it clickable (escaped URL-only text is often not auto-linked).
  let htmlBody = escapeHtml(text).replaceAll("\n", "<br/>");
  if (isHttpResetUrl(input.resetUrl)) {
    const escapedUrl = escapeHtml(input.resetUrl);
    const anchor = `<a href="${escapedUrl}">${escapedUrl}</a>`;
    htmlBody = htmlBody.replaceAll(escapedUrl, anchor);
  }

  const html = `<p style="font-family:Inter,system-ui,sans-serif;line-height:1.5">${htmlBody}</p>`;
  return { subject, text, html };
}
