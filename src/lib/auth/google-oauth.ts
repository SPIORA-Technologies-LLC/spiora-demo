import "server-only";

import { NextResponse } from "next/server";
import { checkRequestOrigin } from "@/lib/auth/security";
import { checkPasswordIpRateLimit } from "@/lib/auth/password-rate-limit";
import {
  insertSecurityAuditEvent,
  reportSecurityAuditFailure,
} from "@/lib/auth/security-audit";
import {
  hashAuditIp,
  truncateClientIp,
} from "@/lib/auth/password-recovery-gate";
import {
  buildGoogleOAuthCallbackUrl,
  evaluateGoogleOAuthAccess,
  googleOAuthDenyPath,
  googleOAuthSuccessPath,
  type GoogleOAuthAudience,
} from "@/lib/auth/google-oauth-access";
import {
  createSupabaseAuthCookieCollector,
  jsonWithAuthCookies,
  redirectWithAuthCookies,
  type MutableCookie,
} from "@/lib/supabase/auth-cookie-response";
import { getCanonicalAppOrigin } from "@/lib/auth/canonical-app-origin";
import { sbGetUserProfileByAuthUserId } from "@/lib/supabase/user-profiles-repo";
import { sbGetClientPortalUserByAuthUserId } from "@/lib/supabase/client-portal-users-repo";
import {
  EMPLOYEE_RECOVERY_COOKIE,
  CLIENT_RECOVERY_COOKIE,
} from "@/lib/auth/password-recovery-gate";

function requestMeta(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent");
  return { origin, host, ip, userAgent };
}

async function safeAudit(
  input: Parameters<typeof insertSecurityAuditEvent>[0],
): Promise<void> {
  const result = await insertSecurityAuditEvent(input);
  if (!result.ok && result.reason !== "audit_disabled") {
    reportSecurityAuditFailure({
      action: input.action,
      audience: input.audience,
      reason: result.reason,
    });
  }
}

export async function handleGoogleOAuthStart(input: {
  request: Request;
  audience: GoogleOAuthAudience;
}): Promise<NextResponse> {
  const { origin, host, ip, userAgent } = requestMeta(input.request);
  const originCheck = checkRequestOrigin(origin, host);
  if (!originCheck.ok && originCheck.reason === "origin-mismatch") {
    return NextResponse.json(
      { error: { code: "ORIGIN_MISMATCH" } },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ipLimit = await checkPasswordIpRateLimit("oauth-ip", ip);
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" } },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const redirectTo = buildGoogleOAuthCallbackUrl(input.audience);
  if (!redirectTo) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  await safeAudit({
    action: "google_oauth_started",
    audience: input.audience,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    userAgent,
    metadata: { provider: "google" },
  });

  try {
    const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });
    const mutations = drainCookies();

    if (error || !data.url) {
      await safeAudit({
        action: "google_oauth_failed",
        audience: input.audience,
        truncatedClientIp: truncateClientIp(ip),
        ipHash: ip ? hashAuditIp(ip) : null,
        userAgent,
        metadata: { provider: "google", reason: "start_failed" },
      });
      return jsonWithAuthCookies(
        { error: { code: "AUTH_UNAVAILABLE" } },
        mutations,
        { status: 503 },
      );
    }

    return jsonWithAuthCookies({ url: data.url }, mutations);
  } catch {
    await safeAudit({
      action: "google_oauth_failed",
      audience: input.audience,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata: { provider: "google", reason: "start_exception" },
    });
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function stripRecoveryCookies(mutations: MutableCookie[]): MutableCookie[] {
  return mutations.filter(
    (cookie) =>
      cookie.name !== EMPLOYEE_RECOVERY_COOKIE &&
      cookie.name !== CLIENT_RECOVERY_COOKIE,
  );
}

export async function handleGoogleOAuthCallback(input: {
  request: Request;
  audience: GoogleOAuthAudience;
}): Promise<NextResponse> {
  const { ip, userAgent } = requestMeta(input.request);
  // Ignore spoofable query params for access decisions.
  const url = new URL(input.request.url);
  void url.searchParams.get("audience");
  void url.searchParams.get("next");
  void url.searchParams.get("type");

  const origin = getCanonicalAppOrigin();
  if (!origin) {
    await safeAudit({
      action: "google_oauth_failed",
      audience: input.audience,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata: { provider: "google", reason: "origin_unconfigured" },
    });
    // Absolute URL required; without canonical we cannot safely redirect.
    return NextResponse.json(
      { error: { code: "AUTH_UNAVAILABLE" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const denyUrl = new URL(googleOAuthDenyPath(input.audience), origin);
  const successUrl = new URL(googleOAuthSuccessPath(input.audience), origin);
  const code = url.searchParams.get("code");

  const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();

  const deny = async (reason: string, authUserId?: string | null) => {
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      // ignore
    }
    const mutations = stripRecoveryCookies(drainCookies());
    await safeAudit({
      action: "google_oauth_denied",
      audience: input.audience,
      actorUserId: authUserId ?? null,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata: { provider: "google", reason },
    });
    return redirectWithAuthCookies(denyUrl, mutations);
  };

  if (!code) {
    await safeAudit({
      action: "google_oauth_failed",
      audience: input.audience,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata: { provider: "google", reason: "no_code" },
    });
    return redirectWithAuthCookies(denyUrl, stripRecoveryCookies(drainCookies()));
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    const mutations = stripRecoveryCookies(drainCookies());
    await safeAudit({
      action: "google_oauth_failed",
      audience: input.audience,
      truncatedClientIp: truncateClientIp(ip),
      ipHash: ip ? hashAuditIp(ip) : null,
      userAgent,
      metadata: { provider: "google", reason: "exchange_failed" },
    });
    return redirectWithAuthCookies(denyUrl, mutations);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return deny("no_user");
  }

  const [employee, client] = await Promise.all([
    sbGetUserProfileByAuthUserId(user.id).catch(() => null),
    sbGetClientPortalUserByAuthUserId(user.id).catch(() => null),
  ]);

  const access = evaluateGoogleOAuthAccess({
    audience: input.audience,
    employee,
    client,
  });

  if (!access.ok) {
    return deny(access.reason, user.id);
  }

  const mutations = stripRecoveryCookies(drainCookies());

  // Audit must not flip success → failure.
  await safeAudit({
    action: "google_oauth_success",
    audience: input.audience,
    actorUserId: user.id,
    targetUserId: user.id,
    truncatedClientIp: truncateClientIp(ip),
    ipHash: ip ? hashAuditIp(ip) : null,
    userAgent,
    metadata: { provider: "google" },
  });

  let finalSuccessUrl = successUrl;
  if (input.audience === "employee") {
    const { isEmployeeMfaEnabled } = await import("@/lib/auth/mfa-config");
    const { needsMfaChallenge, reconcileAalWithVerifiedFactors } = await import(
      "@/lib/auth/mfa-aal"
    );
    if (isEmployeeMfaEnabled()) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        const { data: aal } = accessToken
          ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken)
          : await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        let snapshot = {
          currentLevel: aal?.currentLevel ?? null,
          nextLevel: aal?.nextLevel ?? null,
        };
        if (
          snapshot.currentLevel === "aal1" &&
          snapshot.nextLevel !== "aal2"
        ) {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          snapshot =
            reconcileAalWithVerifiedFactors(
              snapshot,
              factors?.totp?.length ?? 0,
            ) ?? snapshot;
        }
        if (needsMfaChallenge(snapshot)) {
          const intended = successUrl.pathname + successUrl.search;
          finalSuccessUrl = new URL(
            `/mfa/challenge?next=${encodeURIComponent(intended)}`,
            origin,
          );
        }
      } catch {
        // If AAL lookup fails, fall through to success path; middleware will re-check.
      }
    }
  }

  return redirectWithAuthCookies(finalSuccessUrl, mutations);
}
