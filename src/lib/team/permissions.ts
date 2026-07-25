import type { SessionUser } from "@/lib/auth/types";

/** Only the platform owner can add or remove managers. */
export function canManageTeam(user: SessionUser): boolean {
  return user.role === "owner";
}

export function canDeleteTeamMembers(user: SessionUser): boolean {
  return canManageTeam(user);
}

export function canDeleteTeamMember(
  actor: SessionUser,
  target: { id: string; role: string },
): boolean {
  if (!canManageTeam(actor)) return false;
  if (actor.id === target.id) return false;
  if (target.role !== "manager") return false;
  return true;
}
