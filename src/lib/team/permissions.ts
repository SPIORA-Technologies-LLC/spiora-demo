import type { SessionUser } from "@/lib/auth/types";

/** Only the platform owner can add or remove team members. */
export function canManageTeam(user: SessionUser): boolean {
  return user.role === "owner";
}

export function canDeleteTeamMembers(user: SessionUser): boolean {
  return canManageTeam(user);
}

const DELETABLE_TEAM_ROLES = new Set(["manager", "finance_manager"]);

export function canDeleteTeamMember(
  actor: SessionUser,
  target: { id: string; role: string },
): boolean {
  if (!canManageTeam(actor)) return false;
  if (actor.id === target.id) return false;
  if (!DELETABLE_TEAM_ROLES.has(target.role)) return false;
  return true;
}

/** Owner-only online-hours stats for non-owner teammates. */
export function canViewTeamMemberActivity(
  actor: SessionUser,
  target: { id: string; role: string },
): boolean {
  if (!canManageTeam(actor)) return false;
  if (actor.id === target.id) return false;
  if (target.role === "owner") return false;
  return true;
}
