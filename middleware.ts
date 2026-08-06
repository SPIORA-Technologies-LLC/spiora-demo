import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/config";
import { canAccessPath } from "@/lib/auth/permissions";
import { resolveSessionFromAuthUserId } from "@/lib/auth/middleware-session";
import { getAuthProvider } from "@/lib/auth/provider";
import { getSessionFromToken } from "@/lib/auth/session";
import { updateSupabaseAuthSession } from "@/lib/supabase/middleware-auth";

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
    pathname.startsWith("/client/reset-password/")
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

  if (provider === "supabase") {
    const refreshed = await updateSupabaseAuthSession(request);
    supabaseResponse = refreshed.response;
    authUserId = refreshed.user?.id ?? null;
    session = await resolveSessionFromAuthUserId(authUserId);
  } else {
    const token = request.cookies.get("spiora_session")?.value;
    session = await getSessionFromToken(token);
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
      url.pathname = "/dashboard";
      return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
    }

    // Client session is enforced in /client layout via getClientSession().
    // Middleware only blocks employees and lets unauthenticated hit layout → /client/login.
    const intlResponse = intlMiddleware(request);
    intlResponse.headers.set("Cache-Control", "no-store");
    return withSupabaseCookies(intlResponse, supabaseResponse);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session ? "/dashboard" : "/login";
    return withSupabaseCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (isPublicPath(pathname)) {
    if (session && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
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
    "/auth/confirm",
    "/auth/confirm/:path*",
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
  ],
};
