import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import { isClientMfaEnabled } from "@/lib/client-portal/mfa-config";
import { evaluateMfaChallengeRequired } from "@/lib/auth/mfa-evaluate";

function getAnonKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    null
  );
}

type CookieToSet = {
  name: string;
  value: string;
  options?: CookieOptions;
};

/**
 * Refreshes Supabase Auth cookies in middleware.
 * Does not use service role.
 */
export async function updateSupabaseAuthSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getAnonKey();
  if (!url || !anonKey) {
    return {
      response,
      user: null as null,
      mfaChallengeRequired: false,
      clientMfaChallengeRequired: false,
    };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let mfaChallengeRequired = false;
  let clientMfaChallengeRequired = false;

  const employeeMfa = isEmployeeMfaEnabled();
  const clientMfa = isClientMfaEnabled();
  if (user && (employeeMfa || clientMfa)) {
    const needed = await evaluateMfaChallengeRequired(supabase);
    if (employeeMfa) mfaChallengeRequired = needed;
    if (clientMfa) clientMfaChallengeRequired = needed;
  }

  return {
    response,
    user,
    mfaChallengeRequired,
    clientMfaChallengeRequired,
  };
}
