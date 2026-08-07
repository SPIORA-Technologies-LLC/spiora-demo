import "server-only";

import {
  isProfileAccessAllowed,
  sbGetMfaReenrollRequired,
  sbGetUserProfileByAuthUserId,
  sbTouchUserProfileLastLogin,
  type UserProfile,
} from "@/lib/supabase/user-profiles-repo";
import {
  createSupabaseServerAuthClient,
  isSupabaseAuthClientConfigured,
} from "@/lib/supabase/server-auth";
import { profileToSessionUser, type UnifiedSessionUser } from "./map-session";
import { sanitizeAuthErrorMessage } from "./security";
import { isEmployeeMfaEnabled } from "./mfa-config";

export type SupabaseSignInResult =
  | { ok: true; session: UnifiedSessionUser }
  | {
      ok: false;
      code:
        | "auth_unavailable"
        | "invalid_credentials"
        | "missing_profile"
        | "suspended"
        | "archived"
        | "inactive";
    };

export async function signInWithSupabasePassword(
  email: string,
  password: string,
): Promise<SupabaseSignInResult> {
  if (!isSupabaseAuthClientConfigured()) {
    return { ok: false, code: "auth_unavailable" };
  }

  try {
    const supabase = await createSupabaseServerAuthClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const code = sanitizeAuthErrorMessage(error?.message ?? "");
      if (code === "invalid_credentials" || code === "rate_limited") {
        return { ok: false, code: "invalid_credentials" };
      }
      return { ok: false, code: "auth_unavailable" };
    }

    const profile = await sbGetUserProfileByAuthUserId(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { ok: false, code: "missing_profile" };
    }

    const access = evaluateProfileAccess(profile);
    if (!access.ok) {
      await supabase.auth.signOut();
      return access;
    }

    const session = profileToSessionUser(profile);
    if (!session) {
      await supabase.auth.signOut();
      return { ok: false, code: "inactive" };
    }

    await sbTouchUserProfileLastLogin(profile.id);
    return { ok: true, session };
  } catch {
    return { ok: false, code: "auth_unavailable" };
  }
}

export function evaluateProfileAccess(
  profile: UserProfile,
):
  | { ok: true }
  | { ok: false; code: "suspended" | "archived" | "inactive" } {
  if (profile.status === "suspended") {
    return { ok: false, code: "suspended" };
  }
  if (profile.status === "archived" || profile.archivedAt) {
    return { ok: false, code: "archived" };
  }
  if (!isProfileAccessAllowed(profile)) {
    return { ok: false, code: "inactive" };
  }
  return { ok: true };
}

export async function signOutSupabaseAuth(): Promise<void> {
  if (!isSupabaseAuthClientConfigured()) return;
  try {
    const supabase = await createSupabaseServerAuthClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — cookie clear best-effort
  }
}

export async function getSupabaseUnifiedSession(): Promise<UnifiedSessionUser | null> {
  if (!isSupabaseAuthClientConfigured()) return null;

  try {
    const supabase = await createSupabaseServerAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await sbGetUserProfileByAuthUserId(user.id);
    if (!profile) return null;
    if (!isProfileAccessAllowed(profile)) return null;

    const session = profileToSessionUser(profile);
    if (!session) return null;

    if (isEmployeeMfaEnabled()) {
      session.mfaReenrollRequired = await sbGetMfaReenrollRequired(user.id);
    }

    return session;
  } catch {
    return null;
  }
}
