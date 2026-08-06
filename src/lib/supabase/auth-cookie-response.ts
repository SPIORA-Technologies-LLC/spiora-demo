import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type MutableCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

function getAnonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    null
  );
}

/**
 * Route-handler Supabase auth client that records Set-Cookie mutations
 * so they can be applied to a single final NextResponse (after signOut).
 */
export async function createSupabaseAuthCookieCollector(): Promise<{
  supabase: ReturnType<typeof createServerClient>;
  drainCookies: () => MutableCookie[];
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getAnonKey();
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase auth client is not configured");
  }

  const cookieStore = await cookies();
  const pending: MutableCookie[] = [];

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: MutableCookie[]) {
        for (const item of cookiesToSet) {
          pending.push(item);
          try {
            cookieStore.set(item.name, item.value, item.options);
          } catch {
            // Route handlers may still apply via NextResponse.
          }
        }
      },
    },
  });

  return {
    supabase,
    drainCookies: () => [...pending],
  };
}

export function applyCookiesToResponse(
  response: NextResponse,
  mutations: MutableCookie[],
): NextResponse {
  for (const { name, value, options } of mutations) {
    response.cookies.set(name, value, options);
  }
  return response;
}

/**
 * Build JSON response that includes Supabase auth cookie updates + extras.
 */
export function jsonWithAuthCookies(
  body: Record<string, unknown>,
  mutations: MutableCookie[],
  init?: { status?: number },
): NextResponse {
  const response = NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { "Cache-Control": "no-store" },
  });
  return applyCookiesToResponse(response, mutations);
}

export function redirectWithAuthCookies(
  url: string | URL,
  mutations: MutableCookie[],
): NextResponse {
  const response = NextResponse.redirect(url);
  return applyCookiesToResponse(response, mutations);
}
