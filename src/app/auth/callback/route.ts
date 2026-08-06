import { NextResponse } from "next/server";
import {
  createSupabaseAuthCookieCollector,
  redirectWithAuthCookies,
} from "@/lib/supabase/auth-cookie-response";
import { getCanonicalAppOrigin } from "@/lib/auth/canonical-app-origin";
import { isSafeAppPath } from "@/lib/auth/security";

export const dynamic = "force-dynamic";

/**
 * PKCE / OAuth code exchange only.
 * Never mints password recovery gate cookies — even if type=recovery is spoofed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = getCanonicalAppOrigin() ?? url.origin;

  // Spoofed recovery signals must be ignored for gate purposes.
  void url.searchParams.get("type");
  void url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  const { supabase, drainCookies } = await createSupabaseAuthCookieCollector();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  const mutations = drainCookies();

  if (error) {
    return redirectWithAuthCookies(new URL("/login?error=auth", origin), mutations);
  }

  // Safe post-login only — never trust query next for recovery.
  const nextRaw = url.searchParams.get("next") ?? "/dashboard";
  const next =
    isSafeAppPath(nextRaw) &&
    !nextRaw.startsWith("/reset-password") &&
    !nextRaw.startsWith("/client/reset-password") &&
    !nextRaw.startsWith("/auth/")
      ? nextRaw
      : "/dashboard";

  return redirectWithAuthCookies(new URL(next, origin), mutations);
}
