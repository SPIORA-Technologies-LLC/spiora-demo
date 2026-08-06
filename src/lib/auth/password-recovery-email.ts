import "server-only";

import { isMailConfigured } from "@/lib/mail/config";
import { sendEmail, type SendEmailResult } from "@/lib/mail/send-email";
import { buildRecoveryEmailHref } from "@/lib/auth/recovery-email-template";
import { buildPasswordRecoveryEmailContent } from "@/lib/auth/password-recovery-email-content";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { AppLocale } from "@/i18n/config";

export type SendPasswordRecoveryEmailInput = {
  email: string;
  redirectTo: string;
  locale: AppLocale | string;
};

export { buildPasswordRecoveryEmailContent };

/**
 * Prefer Brevo + admin generateLink so copy follows UI locale.
 * Returns true when a localized email was sent (caller should skip Supabase Auth mail).
 * Failures are swallowed at the call site — never reveal whether the account exists.
 */
export async function trySendLocalizedPasswordRecoveryEmail(
  input: SendPasswordRecoveryEmailInput,
): Promise<boolean> {
  if (!isMailConfigured() || !isSupabaseConfigured()) {
    return false;
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: input.email.trim().toLowerCase(),
      options: { redirectTo: input.redirectTo },
    });
    if (error) return false;

    const hashedToken = data.properties?.hashed_token;
    if (!hashedToken) return false;

    const resetUrl = buildRecoveryEmailHref(input.redirectTo, hashedToken);
    if (!resetUrl) return false;

    const content = buildPasswordRecoveryEmailContent({
      resetUrl,
      locale: input.locale,
    });
    const result: SendEmailResult = await sendEmail({
      to: input.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return result.ok;
  } catch {
    return false;
  }
}
