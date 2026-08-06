import "server-only";

import type { AppLocale } from "@/i18n/config";
import { parseLocale } from "@/i18n/config";
import { getNestedMessage, getMessagesForLocale } from "@/i18n/messages";
import { sendEmail } from "@/lib/mail/send-email";
import { isMailConfigured } from "@/lib/mail/config";
import type { PasswordRecoveryAudience } from "./password-recovery-gate";

function message(locale: AppLocale, keyPath: string): string {
  return (
    getNestedMessage(getMessagesForLocale(locale), keyPath) ??
    getNestedMessage(getMessagesForLocale("en"), keyPath) ??
    keyPath
  );
}

export async function sendPasswordSecurityNotification(input: {
  to: string;
  audience: PasswordRecoveryAudience;
  kind: "changed" | "reset";
  locale?: AppLocale | string;
}): Promise<void> {
  if (!isMailConfigured()) return;

  const locale = parseLocale(input.locale);
  const planeKey =
    input.audience === "employee"
      ? "authPassword.notify.planeEmployee"
      : "authPassword.notify.planeClient";
  const kindKey =
    input.kind === "changed"
      ? "authPassword.notify.kindChanged"
      : "authPassword.notify.kindReset";
  const subjectKey =
    input.kind === "changed"
      ? "authPassword.notify.subjectChanged"
      : "authPassword.notify.subjectReset";

  const subject = message(locale, subjectKey);
  const text = [
    message(locale, "authPassword.notify.intro")
      .replaceAll("{plane}", message(locale, planeKey))
      .replaceAll("{kind}", message(locale, kindKey)),
    "",
    message(locale, "authPassword.notify.warning"),
    "",
    message(locale, "authPassword.notify.noPassword"),
  ].join("\n");

  await sendEmail({
    to: input.to,
    subject,
    text,
  });
}
