import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/config";
import { canAccessPath } from "@/lib/auth/permissions";
import { resolveSessionFromAuthUserId } from "@/lib/auth/middleware-session";
import { getAuthProvider } from "@/lib/auth/provider";
import { getSessionFromToken } from "@/lib/auth/session";
import { updateSupabaseAuthSession } from "@/lib/supabase/middleware-auth";
import {
  isClientApiPath,
  isClientMfaExemptApiPath,
  isClientMfaGatePath,
  isEmployeeApiPath,
  isMfaExemptApiPath,
  isMfaGatePath,
} from "@/lib/auth/mfa-paths";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = [
  "/login",
  "/join",
  "/api/webhooks",
  "/client/invite",
  "/client/login",
  "/forgot-password",
  "/reset-password",
  "/client/forgot-password",
  "/client/reset-password",
  "/client/privacy",
  "/auth/callback",
  "/auth/confirm",
];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clients",
  "/client-invitations",
  "/ai-workspace",
  "/knowledge-base",
  "/tasks",
  "/calendar",
  "/meeting-recordings",
  "/team-chat",
  "/relocation",
  "/checkups-erevan",
  "/analytics",
  "/team",
  "/settings",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isClientPortalPath(pathname: string) {
  return pathname === "/client" || pathname.startsWith("/client/");
}

function isClientPublicPath(pathname: string) {
  return (
    pathname.startsWith("/client/invite") ||
    pathname === "/client/login" ||
    pathname.startsWith("/client/login/") ||
    pathname === "/client/forgot-password" ||
    pathname.startsWith("/client/forgot-password/") ||
    pathname === "/client/reset-password" ||
    pathname.startsWith("/client/reset-password/") ||
    pathname === "/client/privacy" ||
    pathname.startsWith("/client/privacy/")
  );
}

function withSupabaseCookies(
  response: NextResponse,
  supabaseResponse: NextResponse | null,
) {
  if (supabaseResponse) {
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie);
    }
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/locale")) {
    return NextResponse.next();
  }

  const provider = getAuthProvider();
  let session = null as Awaited<ReturnType<typeof getSessionFromToken>>;
  let supabaseResponse: NextResponse | null = null;
  let authUserId: string | null = null;
  let mfaChallengeRequired = false;
  let clientMfaChallengeRequired = false;

  if (provider === "supabase") {
    const refreshed = await updateSupabaseAuthSession(request);
    supabaseResponse = refreshed.response;
    authUserId = refreshed.user?.id ?? null;
    mfaChallengeRequired = refreshed.mfaChallengeRequired;
    clientMfaChallengeRequired = refreshed.clientMfaChallengeRequired;
    session = await resolveSessionFromAuthUserId(authUserId);
  } else {
    const token = request.cookies.get("spiora_session")?.value;
    session = await getSessionFromToken(token);
  }

  // Hard API AAL2 gate (UX redirect alone is not enough).
  if (
    provider === "supabase" &&
    session &&
    mfaChallengeRequired &&
    isEmployeeApiPath(pathname) &&
    !isMfaExemptApiPath(pathname)
  ) {
    return withSupabaseCookies(
      NextResponse.json(
        { error: { code: "MFA_REQUIRED" } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
      supabaseResponse,
    );
  }

  // Client-plane MFA hard gate (separate from employee; /api/client stays employee-exempt).
  if (
    provider === "supabase" &&
    authUserId &&
    clientMfaChallengeRequired &&
    isClientApiPath(pathname) &&
    !isClientMfaExemptApiPath(pathname)
  ) {
    return withSupabaseCookies(
      NextResponse.json(
        { error: { code: "MFA_REQUIRED" } },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      ),
      supabaseResponse,
    );
  }

  // Spiora Client paths: never treat employee SessionUser as client access.
  if (isClientPortalPath(pathname)) {
    if (isClientPublicPath(pathname)) {
      const headers = new Headers(request.headers);
      const response = NextResponse.next({ request: { headers } });
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("Referrer-Policy", "no-referrer");
      const intlResponse = intlMiddleware(request);
      for (const [key, value] of response.headers.entries()) {
        intlResponse.headers.set(key, value);
      }
      return withSupabaseCookies(intlResponse, supabaseResponse);
    }

    // Employee sessions cannot enter the client portal shell.
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = mfaChallengeRequired ? "/mfa/challenge" : "/dashboard";
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // Client MFA challenge / recovery pages: allow AAL1 while authenticated.
    if (isClientMfaGatePath(pathname)) {
      const intlResponse = intlMiddleware(request);
      intlResponse.headers.set("Cache-Control", "no-store");
      return withSupabaseCookies(intlResponse, supabaseResponse);
    }

    // Protected client pages: enforce AAL2 when verified TOTP exists.
    if (clientMfaChallengeRequired) {
      const url = request.nextUrl.clone();
      url.pathname = "/client/mfa/challenge";
      url.searchParams.set("next", pathname);
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // Client session is enforced in /client layout via getClientSession().
    const intlResponse = intlMiddleware(request);
    intlResponse.headers.set("Cache-Control", "no-store");
    return withSupabaseCookies(intlResponse, supabaseResponse);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    if (!session) {
      url.pathname = "/login";
    } else if (mfaChallengeRequired) {
      url.pathname = "/mfa/challenge";
    } else {
      url.pathname = "/dashboard";
    }
    return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (isMfaGatePath(pathname)) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }
    const intlResponse = intlMiddleware(request);
    return withSupabaseCookies(intlResponse, supabaseResponse);
  }

  if (isPublicPath(pathname)) {
    if (session && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = mfaChallengeRequired ? "/mfa/challenge" : "/dashboard";
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }
  } else if (isProtectedPath(pathname)) {
    // Client Auth users without user_profiles resolve to null session → login.
    // They must never pass employee ACL.
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    if (mfaChallengeRequired) {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa/challenge";
      url.searchParams.set("next", pathname);
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    if (!canAccessPath(session.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }
  }

  const intlResponse = intlMiddleware(request);
  return withSupabaseCookies(intlResponse, supabaseResponse);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/join",
    "/join/:path*",
    "/forgot-password",
    "/reset-password",
    "/auth/callback",
    "/auth/callback/:path*",
    "/auth/confirm",
    "/auth/confirm/:path*",
    "/mfa",
    "/mfa/:path*",
    "/client",
    "/client/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/clients",
    "/clients/:path*",
    "/client-invitations",
    "/client-invitations/:path*",
    "/ai-workspace",
    "/ai-workspace/:path*",
    "/knowledge-base",
    "/knowledge-base/:path*",
    "/tasks",
    "/tasks/:path*",
    "/calendar",
    "/calendar/:path*",
    "/meeting-recordings",
    "/meeting-recordings/:path*",
    "/team-chat",
    "/team-chat/:path*",
    "/relocation",
    "/relocation/:path*",
    "/checkups-erevan",
    "/checkups-erevan/:path*",
    "/analytics",
    "/analytics/:path*",
    "/team",
    "/team/:path*",
    "/settings",
    "/settings/:path*",
    "/api/:path*",
  ],
};
