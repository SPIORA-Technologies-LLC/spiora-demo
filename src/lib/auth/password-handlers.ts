import "server-only";

import { NextResponse } from "next/server";
import { checkRequestOrigin } from "@/lib/auth/security";
import { validateNewPassword } from "@/lib/auth/password-store";
import {
  applyRecoveryGateCookie,
  clearRecoveryGateCookie,
  createRecoveryGateToken,
  hashAuditEmail,
  hashAuditIp,
  recoveryCookieName,
  truncateClientIp,
  verifyRecoveryGateToken,
  type PasswordRecoveryAudience,
} from "@/lib/auth/password-recovery-gate";
import { resolvePasswordPlaneForAudience } from "@/lib/auth/password-plane";
import { verifyCurrentPasswordWithEphemeralClient } from "@/lib/auth/password-reauth-client";
import {
  checkPasswordFlowRateLimit,
  checkPasswordIpRateLimit,
} from "@/lib/auth/password-rate-limit";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import { sendPasswordSecurityNotification } from "@/lib/auth/password-security-notify";
import { buildPasswordRecoveryConfirmUrl } from "@/lib/auth/canonical-app-origin";
import {
  createSupabaseAuthCookieCollector,
  jsonWithAuthCookies,
} from "@/lib/supabase/auth-cookie-response";
import { assertRecoveryRedirectToHasNoQuery } from "@/lib/auth/recovery-email-template";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";

function requestMeta(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent");
  return { origin, host, ip, userAgent };
}

function jsonError(code: string, status: number, message?: string) {
  return NextResponse.json(
    { error: { code, message: message ?? code } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function handlePasswordForgot(input: {
  request: Request;
  audience: PasswordRecoveryAudience;
  body: { email?: string; locale?: string };
}): Promise<NextResponse> {
  const { origin, host, ip, userAgent } = requestMeta(input.request);
  const originCheck = checkRequestOrigin(origin, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return jsonError("ORIGIN_MISMATCH", 403);
  }

  const email = String(input.body.email ?? "").trim().toLowerCase();
  const generic = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );

  const ipLimit = await checkPasswordIpRateLimit("forgot-ip", ip);
  if (!ipLimit.allowed) {
    return jsonError("RATE_LIMITED", 429);
  }

  if (!email || !email.includes("@")) {
    // Same public shape — no enumeration via validation timing ideally.
    return generic;
  }

  const emailLimit = await checkPasswordFlowRateLimit("forgot", email, ip);
  if (!emailLimit.allowed) {
    return jsonError("RATE_LIMITED", 429);
  }

  const redirectTo = buildPasswordRecoveryConfirmUrl(input.audience);
  if (!redirectTo || !assertRecoveryRedirectToHasNoQuery(redirectTo)) {
    return jsonError("AUTH_UNAVAILABLE", 503);
  }

  const { isAppLocale } = await import("@/i18n/config");
  const { getRequestLocale } = await import("@/i18n/api-messages");
  const locale = isAppLocale(input.body.locale)
    ? input.body.locale
    : await getRequestLocale();

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
    // swallow
  }

  const audit = await insertSecurityAuditEvent({
    action: "password_reset_requested",
    audience: input.audience,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    emailHash: hashAuditEmail(email),
    userAgent,
    metadata: {},
  });
  if (!audit.ok && audit.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: "password_reset_requested",
      audience: input.audience,
      reason: audit.reason,
    });
  }

  return generic;
}

export async function handlePasswordChange(input: {
  request: Request;
  audience: PasswordRecoveryAudience;
  body: { currentPassword?: string; newPassword?: string; locale?: string };
}): Promise<NextResponse> {
  const { origin, host, ip, userAgent } = requestMeta(input.request);
  const originCheck = checkRequestOrigin(origin, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return jsonError("ORIGIN_MISMATCH", 403);
  }

  const currentPassword = String(input.body.currentPassword ?? "");
  const newPassword = String(input.body.newPassword ?? "");
  const validation = validateNewPassword(newPassword);
  if (validation) {
    return jsonError("INVALID_PASSWORD", 400, validation);
  }
  if (!currentPassword) {
    return jsonError("CURRENT_PASSWORD_VERIFICATION_FAILED", 401);
  }

  const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) {
    return jsonError("UNAUTHORIZED", 401);
  }

  const plane = await resolvePasswordPlaneForAudience(user.id, input.audience);
  if (!plane.ok) {
    return jsonError("FORBIDDEN", 403);
  }

  const rate = await checkPasswordFlowRateLimit("change", user.email, ip);
  if (!rate.allowed) {
    return jsonError("RATE_LIMITED", 429);
  }

  const reauth = await verifyCurrentPasswordWithEphemeralClient({
    email: user.email,
    password: currentPassword,
  });
  if (!reauth.ok) {
    await insertSecurityAuditEvent({
      action: "password_change_failure",
      audience: input.audience,
      actorUserId: user.id,
      targetUserId: user.id,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      emailHash: hashAuditEmail(user.email),
      userAgent,
      metadata: { reason: "CURRENT_PASSWORD_VERIFICATION_FAILED" },
    });
    return jsonError("CURRENT_PASSWORD_VERIFICATION_FAILED", 401);
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    await insertSecurityAuditEvent({
      action: "password_change_failure",
      audience: input.audience,
      actorUserId: user.id,
      targetUserId: user.id,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      emailHash: hashAuditEmail(user.email),
      userAgent,
      metadata: { reason: "UPDATE_FAILED" },
    });
    return jsonError("PASSWORD_UPDATE_FAILED", 400);
  }

  await supabase.auth.signOut({ scope: "others" });
  const mutations = drainCookies();

  const auditOk = await insertSecurityAuditEvent({
    action: "password_change_success",
    audience: input.audience,
    actorUserId: user.id,
    targetUserId: user.id,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    emailHash: hashAuditEmail(user.email),
    userAgent,
    metadata: {},
  });
  const revoked = await insertSecurityAuditEvent({
    action: "sessions_revoked",
    audience: input.audience,
    actorUserId: user.id,
    targetUserId: user.id,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    emailHash: hashAuditEmail(user.email),
    userAgent,
    metadata: { scope: "others" },
  });
  for (const result of [auditOk, revoked]) {
    if (!result.ok && result.reason !== "audit_disabled") {
      reportSecurityAuditFailure({
        action: "password_change_success",
        audience: input.audience,
        reason: result.reason,
      });
    }
  }

  const { isAppLocale } = await import("@/i18n/config");
  const { getRequestLocale } = await import("@/i18n/api-messages");
  const notifyLocale = isAppLocale(input.body.locale)
    ? input.body.locale
    : await getRequestLocale();

  void sendPasswordSecurityNotification({
    to: user.email,
    audience: input.audience,
    kind: "changed",
    locale: notifyLocale,
  });

  return jsonWithAuthCookies({ ok: true }, mutations);
}

export async function handlePasswordReset(input: {
  request: Request;
  audience: PasswordRecoveryAudience;
  body: { password?: string; locale?: string };
}): Promise<NextResponse> {
  const { origin, host, ip, userAgent } = requestMeta(input.request);
  const originCheck = checkRequestOrigin(origin, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return jsonError("ORIGIN_MISMATCH", 403);
  }

  const password = String(input.body.password ?? "");
  const validation = validateNewPassword(password);
  if (validation) {
    return jsonError("INVALID_PASSWORD", 400, validation);
  }

  const ipLimit = await checkPasswordIpRateLimit("reset-ip", ip);
  if (!ipLimit.allowed) {
    return jsonError("RATE_LIMITED", 429);
  }

  const cookieHeader = input.request.headers.get("cookie") ?? "";
  const cookieName = recoveryCookieName(input.audience);
  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  const gateToken = match
    ? decodeURIComponent(match.slice(cookieName.length + 1))
    : undefined;

  const gate = await verifyRecoveryGateToken(gateToken, input.audience);
  if (!gate) {
    return jsonError("RECOVERY_GATE_INVALID", 403);
  }

  const subLimit = await checkPasswordFlowRateLimit("reset", gate.sub, ip);
  if (!subLimit.allowed) {
    return jsonError("RATE_LIMITED", 429);
  }

  const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || user.id !== gate.sub) {
    return jsonError("RECOVERY_GATE_INVALID", 403);
  }

  const plane = await resolvePasswordPlaneForAudience(user.id, input.audience);
  if (!plane.ok) {
    return jsonError("FORBIDDEN", 403);
  }

  // Recovery sessions are AAL1. With MFA enrolled, user-scoped updateUser({ password })
  // is rejected ("AAL2 session is required…"). After gate + plane checks, set password
  // via service role so forgot-password works for MFA users.
  if (!isSupabaseConfigured()) {
    return jsonError("AUTH_UNAVAILABLE", 503);
  }
  const admin = getSupabaseAdmin();
  const { error: updateError } = await admin.auth.admin.updateUserById(
    user.id,
    { password },
  );
  if (updateError) {
    await insertSecurityAuditEvent({
      action: "password_reset_failed",
      audience: input.audience,
      actorUserId: user.id,
      targetUserId: user.id,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      emailHash: user.email ? hashAuditEmail(user.email) : null,
      userAgent,
      metadata: {
        reason: "UPDATE_FAILED",
        detail: updateError.message.slice(0, 160),
      },
    });
    return jsonError("PASSWORD_UPDATE_FAILED", 400);
  }

  await supabase.auth.signOut();
  const mutations = drainCookies();
  const response = jsonWithAuthCookies(
    { ok: true, requireLogin: true },
    mutations,
  );
  clearRecoveryGateCookie(response, input.audience);

  const completed = await insertSecurityAuditEvent({
    action: "password_reset_completed",
    audience: input.audience,
    actorUserId: user.id,
    targetUserId: user.id,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    emailHash: user.email ? hashAuditEmail(user.email) : null,
    userAgent,
    metadata: {},
  });
  const revoked = await insertSecurityAuditEvent({
    action: "sessions_revoked",
    audience: input.audience,
    actorUserId: user.id,
    targetUserId: user.id,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    emailHash: user.email ? hashAuditEmail(user.email) : null,
    userAgent,
    metadata: { scope: "global" },
  });
  for (const result of [completed, revoked]) {
    if (!result.ok && result.reason !== "audit_disabled") {
      reportSecurityAuditFailure({
        action: "password_reset_completed",
        audience: input.audience,
        reason: result.reason,
      });
    }
  }

  if (user.email) {
    const { isAppLocale } = await import("@/i18n/config");
    const { getRequestLocale } = await import("@/i18n/api-messages");
    const notifyLocale = isAppLocale(input.body.locale)
      ? input.body.locale
      : await getRequestLocale();
    void sendPasswordSecurityNotification({
      to: user.email,
      audience: input.audience,
      kind: "reset",
      locale: notifyLocale,
    });
  }

  return response;
}

export async function handleRecoveryConfirm(input: {
  request: Request;
  audience: PasswordRecoveryAudience;
}): Promise<NextResponse> {
  const url = new URL(input.request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const failPath =
    input.audience === "employee" ? "/forgot-password" : "/client/forgot-password";
  const successPath =
    input.audience === "employee" ? "/reset-password" : "/client/reset-password";

  const { getCanonicalAppOrigin } = await import(
    "@/lib/auth/canonical-app-origin"
  );
  const origin = getCanonicalAppOrigin();
  if (!origin) {
    return NextResponse.redirect(new URL(failPath, url.origin));
  }

  if (type !== "recovery" || !token_hash) {
    return NextResponse.redirect(new URL(`${failPath}?error=invalid`, origin));
  }

  const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();
  const { error } = await supabase.auth.verifyOtp({
    token_hash,
    type: "recovery",
  });
  if (error) {
    return NextResponse.redirect(new URL(`${failPath}?error=invalid`, origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.redirect(new URL(`${failPath}?error=invalid`, origin));
  }

  const plane = await resolvePasswordPlaneForAudience(user.id, input.audience);
  if (!plane.ok) {
    await supabase.auth.signOut();
    const mutations = drainCookies();
    const response = NextResponse.redirect(
      new URL(`${failPath}?error=profile`, origin),
    );
    return applyMutations(response, mutations);
  }

  const token = await createRecoveryGateToken({
    authUserId: user.id,
    audience: input.audience,
  });
  const mutations = drainCookies();
  const response = NextResponse.redirect(new URL(successPath, origin));
  applyMutations(response, mutations);
  applyRecoveryGateCookie(response, input.audience, token);
  return response;
}

function applyMutations(
  response: NextResponse,
  mutations: { name: string; value: string; options?: Parameters<NextResponse["cookies"]["set"]>[2] }[],
) {
  for (const { name, value, options } of mutations) {
    response.cookies.set(name, value, options);
  }
  return response;
}
