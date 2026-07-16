import type { SessionUser, UserRole, UserStatus } from "./types";
import type { SupportedUserLanguage } from "./user-model";
import type { UserProfile } from "@/lib/supabase/user-profiles-repo";
import { isUserRole } from "./users";

export type UnifiedSessionUser = SessionUser & {
  authUserId: string | null;
  status: UserStatus;
  language: SupportedUserLanguage;
  timezone: string;
};

export function profileToSessionUser(
  profile: UserProfile,
): UnifiedSessionUser | null {
  if (!isUserRole(profile.role)) {
    // consultant/viewer planned but not yet in runtime SessionUser.role
    return null;
  }

  return {
    id: profile.id,
    authUserId: profile.authUserId,
    email: profile.email,
    name: profile.displayName,
    role: profile.role as UserRole,
    status: profile.status,
    language: profile.language,
    timezone: profile.timezone,
  };
}

export function legacyToSessionUser(user: SessionUser): UnifiedSessionUser {
  return {
    ...user,
    authUserId: null,
    status: "active",
    language: "en",
    timezone: "UTC",
  };
}

export function isSessionAccessAllowed(
  session: UnifiedSessionUser | SessionUser | null,
): boolean {
  if (!session) return false;
  const status = "status" in session ? session.status : "active";
  return status === "active";
}
