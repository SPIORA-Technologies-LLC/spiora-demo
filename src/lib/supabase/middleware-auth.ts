import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isEmployeeMfaEnabled } from "@/lib/auth/mfa-config";
import {
  needsMfaChallenge,
  reconcileAalWithVerifiedFactors,
} from "@/lib/auth/mfa-aal";

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
  if (user && isEmployeeMfaEnabled()) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      // Pass JWT so AAL loads factors via getUser(jwt), not empty session.user.factors.
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

      mfaChallengeRequired = needsMfaChallenge(snapshot);
    } catch {
      mfaChallengeRequired = false;
    }
  }

  return { response, user, mfaChallengeRequired };
}
