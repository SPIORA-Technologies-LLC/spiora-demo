import type { AppLocale } from "@/i18n/config";
import { sendEmail } from "@/lib/mail/send-email";

export async function sendSignOtpEmail(input: {
  to: string;
  locale: AppLocale;
  code: string;
  contractNumber: string;
  expiresInMinutes: number;
}) {
  const ru = input.locale === "ru";
  const subject = ru
    ? "Код для подписания договора SPIORA"
    : "SPIORA agreement signing code";
  const text = ru
    ? [
        `Код подтверждения: ${input.code}`,
        `Договор: ${input.contractNumber}`,
        `Код действует ${input.expiresInMinutes} минут.`,
        "Если вы не запрашивали данный код, не сообщайте его третьим лицам.",
      ].join("\n")
    : [
        `Your verification code: ${input.code}`,
        `Agreement: ${input.contractNumber}`,
        `The code is valid for ${input.expiresInMinutes} minutes.`,
        "If you did not request this code, do not share it with anyone.",
      ].join("\n");

  return sendEmail({
    to: input.to,
    subject,
    text,
  });
}
