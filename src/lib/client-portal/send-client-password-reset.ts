import "server-only";

import { buildPasswordRecoveryConfirmUrl } from "@/lib/auth/canonical-app-origin";
import {
  hashAuditEmail,
  hashAuditIp,
  truncateClientIp,
} from "@/lib/auth/password-recovery-gate";
import {
  checkPasswordFlowRateLimit,
  checkPasswordIpRateLimit,
} from "@/lib/auth/password-rate-limit";
import { assertRecoveryRedirectToHasNoQuery } from "@/lib/auth/recovery-email-template";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sbGetInvitationById } from "@/lib/supabase/client-invitations-repo";
import { computeInvitationState } from "./invite-token";
import { localFindInvitationById } from "./local-store";
import { isAppLocale, type AppLocale } from "@/i18n/config";

export type SendClientPasswordResetResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "INVITATION_INVALID" | "RATE_LIMITED" | "AUTH_UNAVAILABLE" };

/**
 * Staff-triggered client password recovery for a known invitation row.
 * Never generates or returns a password. Email is taken only from the invitation record.
 */
export async function sendClientInvitationPasswordReset(input: {
  invitationId: string;
  actorUserId: string;
  ip?: string;
  userAgent?: string | null;
}): Promise<SendClientPasswordResetResult> {
  const invitation = isSupabaseConfigured()
    ? await sbGetInvitationById(input.invitationId)
    : await localFindInvitationById(input.invitationId);
  if (!invitation) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const state = computeInvitationState(invitation);
  if (state !== "pending" && state !== "accepted") {
    return { ok: false, code: "INVITATION_INVALID" };
  }

  const email = invitation.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, code: "INVITATION_INVALID" };
  }

  const ipLimit = await checkPasswordIpRateLimit("staff-forgot-ip", input.ip);
  if (!ipLimit.allowed) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const emailLimit = await checkPasswordFlowRateLimit(
    "staff-forgot",
    email,
    input.ip,
  );
  if (!emailLimit.allowed) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const redirectTo = buildPasswordRecoveryConfirmUrl("client");
  if (!redirectTo || !assertRecoveryRedirectToHasNoQuery(redirectTo)) {
    return { ok: false, code: "AUTH_UNAVAILABLE" };
  }

  const locale: AppLocale = isAppLocale(invitation.preferredLocale)
    ? invitation.preferredLocale
    : "ru";

  try {
    const { trySendLocalizedPasswordRecoveryEmail } = await import(
      "@/lib/auth/password-recovery-email"
    );
    const sentLocalized = await trySendLocalizedPasswordRecoveryEmail({
      email,
      redirectTo,
      locale,
    });
    if (!sentLocalized) {
      const { createSupabaseServerAuthClient } = await import(
        "@/lib/supabase/server-auth"
      );
      const supabase = await createSupabaseServerAuthClient();
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    }
  } catch {
    // Swallow — same public outcome whether Auth user / mail exists.
  }

  const audit = await insertSecurityAuditEvent({
    action: "password_reset_requested",
    audience: "client",
    actorUserId: input.actorUserId,
    truncatedClientIp: truncateClientIp(input.ip),
    ipHash: input.ip ? hashAuditIp(input.ip) : null,
    emailHash: hashAuditEmail(email),
    userAgent: input.userAgent,
    metadata: { source: "staff_invitation" },
  });
  if (!audit.ok && audit.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: "password_reset_requested",
      audience: "client",
      reason: audit.reason,
    });
  }

  return { ok: true };
}
