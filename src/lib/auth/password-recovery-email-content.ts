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

export function buildPasswordRecoveryEmailContent(input: {
  resetUrl: string;
  locale: AppLocale | string;
}): { subject: string; text: string; html: string } {
  const locale = parseLocale(input.locale);
  const subject = message(locale, "authPassword.email.subject");
  const text = message(locale, "authPassword.email.body", {
    resetUrl: input.resetUrl,
  });
  const html = `<p style="font-family:Inter,system-ui,sans-serif;line-height:1.5;white-space:pre-wrap">${escapeHtml(text).replaceAll("\n", "<br/>")}</p>`;
  return { subject, text, html };
}
