import type { SessionUser, UserRole } from "./types";

export type TeamUser = SessionUser & {
  passwordEnvKey: string;
};

/** Demo team roster — fictional accounts only (Northstar Mobility). */
const TEAM_USERS: TeamUser[] = [
  {
    id: "olivia-bennett",
    email: "olivia@spiora.demo",
    name: "Olivia Bennett",
    role: "owner",
    passwordEnvKey: "AUTH_PASSWORD_OWNER",
  },
  {
    id: "daniel-cooper",
    email: "daniel@spiora.demo",
    name: "Daniel Cooper",
    role: "manager",
    passwordEnvKey: "AUTH_PASSWORD_MANAGER_1",
  },
  {
    id: "emma-wilson",
    email: "emma@spiora.demo",
    name: "Emma Wilson",
    role: "manager",
    passwordEnvKey: "AUTH_PASSWORD_MANAGER_2",
  },
  {
    id: "lucas-martin",
    email: "lucas@spiora.demo",
    name: "Lucas Martin",
    role: "manager",
    passwordEnvKey: "AUTH_PASSWORD_MANAGER_3",
  },
  {
    id: "sofia-reyes",
    email: "sofia@spiora.demo",
    name: "Sofia Reyes",
    role: "finance_manager",
    passwordEnvKey: "AUTH_PASSWORD_FINANCE",
  },
];

const DEV_DEFAULT_PASSWORDS: Record<string, string> = {
  "olivia-bennett": "demo-owner-local",
  "daniel-cooper": "demo-manager-local-1",
  "emma-wilson": "demo-manager-local-2",
  "lucas-martin": "demo-manager-local-3",
  "sofia-reyes": "demo-finance-local",
};

export function getEnvStoredPassword(user: TeamUser): string | undefined {
  const fromEnv = process.env[user.passwordEnvKey]?.trim();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    return undefined;
  }

  return DEV_DEFAULT_PASSWORDS[user.id];
}

export function listTeamUsers(): TeamUser[] {
  return TEAM_USERS;
}

export function findUserByEmail(email: string): TeamUser | undefined {
  const normalized = email.trim().toLowerCase();
  return TEAM_USERS.find((u) => u.email.toLowerCase() === normalized);
}

export function toSessionUser(user: TeamUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export function isUserRole(value: string): value is UserRole {
  return value === "owner" || value === "manager" || value === "finance_manager";
}
