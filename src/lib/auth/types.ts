export type UserRole = "owner" | "manager";

export type PlannedUserRole = UserRole | "consultant" | "viewer";

export type UserStatus = "invited" | "active" | "suspended" | "archived";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
