import type { AppLocale } from "@/i18n/config";
import { getNestedMessage, getMessagesForLocale } from "@/i18n/messages";
import { sendEmail, type SendEmailResult } from "@/lib/mail/send-email";
import type { ClientPortalLocale } from "./types";

export type ClientInviteEmailKind =
  | "invite"
  | "invite_existing"
  | "password_reset";

export type SendClientInviteEmailInput = {
  to: string;
  inviteUrl: string;
  temporaryPassword?: string;
  loginUrl?: string;
  locale: ClientPortalLocale | string;
  kind: ClientInviteEmailKind;
  firstName?: string | null;
};

function resolveLocale(locale: string | undefined): AppLocale {
  return locale === "en" ? "en" : "ru";
}

function formatTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

function message(
  locale: AppLocale,
  keyPath: string,
  values?: Record<string, string>,
): string {
  const raw =
    getNestedMessage(getMessagesForLocale(locale), keyPath) ??
    getNestedMessage(getMessagesForLocale("en"), keyPath) ??
    keyPath;
  return values ? formatTemplate(raw, values) : raw;
}

export function buildClientInviteEmailContent(input: {
  email: string;
  inviteUrl: string;
  temporaryPassword?: string;
  loginUrl?: string;
  locale: ClientPortalLocale | string;
  kind: ClientInviteEmailKind;
  firstName?: string | null;
}): { subject: string; text: string; html: string } {
  const locale = resolveLocale(input.locale);
  const subjectKey =
    input.kind === "password_reset"
      ? "clientInvitations.email.subjectPasswordReset"
      : input.kind === "invite_existing"
        ? "clientInvitations.email.subjectInviteExisting"
        : "clientInvitations.email.subjectInvite";
  const subject = message(locale, subjectKey);

  const text =
    input.kind === "invite_existing"
      ? message(locale, "clientInvitations.sharePackageExisting", {
          url: input.inviteUrl,
          email: input.email,
          loginUrl: input.loginUrl || input.inviteUrl,
        })
      : message(locale, "clientInvitations.sharePackage", {
          url: input.inviteUrl,
          email: input.email,
          password: input.temporaryPassword || "",
        });

  // Plain text keeps the raw URL; HTML needs a real <a> so mail clients make it clickable.
  let htmlBody = escapeHtml(text).replaceAll("\n", "<br/>");
  const urls = [input.inviteUrl, input.loginUrl].filter(
    (u): u is string => typeof u === "string" && isHttpUrl(u),
  );
  for (const url of urls) {
    const escapedUrl = escapeHtml(url);
    const anchor = `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${escapedUrl}</a>`;
    htmlBody = htmlBody.replaceAll(escapedUrl, anchor);
  }

  const html = `<p style="font-family:Inter,system-ui,sans-serif;line-height:1.5">${htmlBody}</p>`;

  return { subject, text, html };
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendClientInviteEmail(
  input: SendClientInviteEmailInput,
): Promise<SendEmailResult> {
  const content = buildClientInviteEmailContent({
    email: input.to,
    inviteUrl: input.inviteUrl,
    temporaryPassword: input.temporaryPassword,
    loginUrl: input.loginUrl,
    locale: input.locale,
    kind: input.kind,
    firstName: input.firstName,
  });

  return sendEmail({
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}
