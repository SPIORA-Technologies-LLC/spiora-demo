import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/config";
import { canAccessPath } from "@/lib/auth/permissions";
import { resolveSessionFromAuthUserId } from "@/lib/auth/middleware-session";
import { getAuthProvider } from "@/lib/auth/provider";
import { getSessionFromToken } from "@/lib/auth/session";
import { updateSupabaseAuthSession } from "@/lib/supabase/middleware-auth";

const intlMiddleware = createIntlMiddleware(routing);

const PUBLIC_PATHS = ["/login", "/join", "/api/webhooks"];

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clients",
  "/new-formgrid-clients",
  "/crm",
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/locale")) {
    return NextResponse.next();
  }

  const provider = getAuthProvider();
  let session = null as Awaited<ReturnType<typeof getSessionFromToken>>;
  let supabaseResponse: NextResponse | null = null;

  if (provider === "supabase") {
    const refreshed = await updateSupabaseAuthSession(request);
    supabaseResponse = refreshed.response;
    session = await resolveSessionFromAuthUserId(refreshed.user?.id ?? null);
  } else {
    const token = request.cookies.get("spiora_session")?.value;
    session = await getSessionFromToken(token);
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = session ? "/dashboard" : "/login";
    const redirect = NextResponse.redirect(url);
    if (supabaseResponse) {
      for (const cookie of supabaseResponse.cookies.getAll()) {
        redirect.cookies.set(cookie);
      }
    }
    return redirect;
  }

  if (isPublicPath(pathname)) {
    if (session && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      if (supabaseResponse) {
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(cookie);
        }
      }
      return redirect;
    }
  } else if (isProtectedPath(pathname)) {
    if (!session) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(url);
      if (supabaseResponse) {
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(cookie);
        }
      }
      return redirect;
    }

    if (!canAccessPath(session.role, pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      const redirect = NextResponse.redirect(url);
      if (supabaseResponse) {
        for (const cookie of supabaseResponse.cookies.getAll()) {
          redirect.cookies.set(cookie);
        }
      }
      return redirect;
    }
  }

  const intlResponse = intlMiddleware(request);
  if (supabaseResponse) {
    for (const cookie of supabaseResponse.cookies.getAll()) {
      intlResponse.cookies.set(cookie);
    }
  }
  return intlResponse;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/join",
    "/join/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/clients",
    "/clients/:path*",
    "/new-formgrid-clients",
    "/new-formgrid-clients/:path*",
    "/crm",
    "/crm/:path*",
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
