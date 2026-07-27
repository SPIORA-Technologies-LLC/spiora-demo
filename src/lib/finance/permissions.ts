import type { SessionUser, UserRole } from "@/lib/auth/types";

/** Director (owner) and finance manager can view/manage Finance. */
export function canViewFinance(user: SessionUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "owner" || user.role === "finance_manager";
}

export function canManageFinance(user: SessionUser | null | undefined): boolean {
  return canViewFinance(user);
}

export function isFinanceRole(role: UserRole): boolean {
  return role === "owner" || role === "finance_manager";
}
