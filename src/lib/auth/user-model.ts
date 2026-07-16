import "server-only";

import type { PlannedUserRole, UserStatus } from "./types";

export type SupportedUserLanguage = "en" | "ru";

export type PlatformUserRecord = {
  id: string;
  authUserId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  role: PlannedUserRole;
  status: UserStatus;
  language: SupportedUserLanguage;
  timezone: string;
  createdAt: string;
  archivedAt: string | null;
};

export type PlatformSessionClaims = {
  sub: string;
  email: string;
  role: PlannedUserRole;
  language: SupportedUserLanguage;
  timezone: string;
};

export const PLATFORM_USER_ROLES: readonly PlannedUserRole[] = [
  "owner",
  "manager",
  "consultant",
  "viewer",
];

export const PLATFORM_USER_STATUSES: readonly UserStatus[] = [
  "invited",
  "active",
  "suspended",
  "archived",
];
