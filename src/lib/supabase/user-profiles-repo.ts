import "server-only";

import type { PlannedUserRole, UserStatus } from "@/lib/auth/types";
import type { SupportedUserLanguage } from "@/lib/auth/user-model";

export type UserProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  status: string;
  language: string;
  timezone: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_demo: boolean;
};

export type UserProfile = {
  id: string;
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  role: PlannedUserRole;
  status: UserStatus;
  language: SupportedUserLanguage;
  timezone: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  isDemo: boolean;
};

export type UpdateUserProfileInput = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string | null;
  language?: SupportedUserLanguage;
  timezone?: string;
};

const PROFILE_SELECT =
  "id, auth_user_id, email, first_name, last_name, display_name, avatar_url, role, status, language, timezone, last_login_at, created_at, updated_at, archived_at, is_demo";

function isPlannedRole(value: string): value is PlannedUserRole {
  return (
    value === "owner" ||
    value === "manager" ||
    value === "consultant" ||
    value === "viewer"
  );
}

function isUserStatus(value: string): value is UserStatus {
  return (
    value === "invited" ||
    value === "active" ||
    value === "suspended" ||
    value === "archived"
  );
}

function isLanguage(value: string): value is SupportedUserLanguage {
  return value === "en" || value === "ru";
}

export function mapUserProfileRow(row: UserProfileRow): UserProfile | null {
  if (!isPlannedRole(row.role) || !isUserStatus(row.status)) return null;
  const language = isLanguage(row.language) ? row.language : "en";

  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    language,
    timezone: row.timezone || "UTC",
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    isDemo: Boolean(row.is_demo),
  };
}

export function isProfileAccessAllowed(profile: UserProfile): boolean {
  return profile.status === "active" && !profile.archivedAt;
}

async function getAdmin() {
  const { getSupabaseAdmin } = await import("./server");
  return getSupabaseAdmin();
}

export async function sbGetUserProfileByAuthUserId(
  authUserId: string,
): Promise<UserProfile | null> {
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapUserProfileRow(data as UserProfileRow);
}

export async function sbGetUserProfileById(
  profileId: string,
): Promise<UserProfile | null> {
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapUserProfileRow(data as UserProfileRow);
}

export async function sbGetUserProfileByEmail(
  email: string,
): Promise<UserProfile | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .ilike("email", normalized)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapUserProfileRow(data as UserProfileRow);
}

export async function sbListActiveUserProfiles(): Promise<UserProfile[]> {
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("status", "active")
    .is("archived_at", null)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data as UserProfileRow[])
    .map(mapUserProfileRow)
    .filter((item): item is UserProfile => item !== null);
}

export async function sbUpdateUserProfile(
  profileId: string,
  input: UpdateUserProfileInput,
): Promise<UserProfile> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.firstName !== undefined) patch.first_name = input.firstName;
  if (input.lastName !== undefined) patch.last_name = input.lastName;
  if (input.displayName !== undefined) patch.display_name = input.displayName;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  if (input.language !== undefined) patch.language = input.language;
  if (input.timezone !== undefined) patch.timezone = input.timezone;

  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .update(patch)
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;
  const mapped = mapUserProfileRow(data as UserProfileRow);
  if (!mapped) throw new Error("Invalid profile after update");
  return mapped;
}

export async function sbTouchUserProfileLastLogin(
  profileId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (await getAdmin())
    .from("user_profiles")
    .update({ last_login_at: now, updated_at: now })
    .eq("id", profileId);

  if (error) throw error;
}

export async function sbCountActiveOwners(
  excludeProfileId?: string,
): Promise<number> {
  let query = (await getAdmin())
    .from("user_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "owner")
    .eq("status", "active")
    .is("archived_at", null);

  if (excludeProfileId) {
    query = query.neq("id", excludeProfileId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export type ProfileLifecycleError =
  | "not_found"
  | "last_owner_protected"
  | "invalid_status";

export async function sbSuspendUserProfile(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: ProfileLifecycleError }> {
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, error: "not_found" };

  const profile = mapUserProfileRow(data as UserProfileRow);
  if (!profile) return { ok: false, error: "invalid_status" };

  if (profile.role === "owner") {
    const remaining = await sbCountActiveOwners(profileId);
    if (remaining < 1) {
      return { ok: false, error: "last_owner_protected" };
    }
  }

  const now = new Date().toISOString();
  const { error: updateError } = await (await getAdmin())
    .from("user_profiles")
    .update({
      status: "suspended",
      updated_at: now,
    })
    .eq("id", profileId);

  if (updateError) throw updateError;
  return { ok: true };
}

export async function sbArchiveUserProfile(
  profileId: string,
): Promise<{ ok: true } | { ok: false; error: ProfileLifecycleError }> {
  const { data, error } = await (await getAdmin())
    .from("user_profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, error: "not_found" };

  const profile = mapUserProfileRow(data as UserProfileRow);
  if (!profile) return { ok: false, error: "invalid_status" };

  if (profile.role === "owner") {
    const remaining = await sbCountActiveOwners(profileId);
    if (remaining < 1) {
      return { ok: false, error: "last_owner_protected" };
    }
  }

  const now = new Date().toISOString();
  const { error: updateError } = await (await getAdmin())
    .from("user_profiles")
    .update({
      status: "archived",
      archived_at: now,
      updated_at: now,
    })
    .eq("id", profileId);

  if (updateError) throw updateError;
  return { ok: true };
}
