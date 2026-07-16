export type UserRole = "owner" | "manager";

export type PlannedUserRole = UserRole | "consultant" | "viewer";

export type UserStatus = "invited" | "active" | "suspended" | "archived";

/**
 * Unified app session contract.
 * `name` remains display name for backward compatibility with existing UI/API.
 * Extended fields are populated in Supabase Auth mode; legacy fills safe defaults.
 */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  authUserId?: string | null;
  status?: UserStatus;
  language?: "en" | "ru";
  timezone?: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Владелец",
  manager: "Менеджер",
};

export const PLANNED_ROLE_LABELS: Record<PlannedUserRole, string> = {
  owner: "Владелец",
  manager: "Менеджер",
  consultant: "Консультант",
  viewer: "Наблюдатель",
};
