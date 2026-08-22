import type { SessionUser } from "@/lib/auth/types";

/** Owner, finance manager, and manager can view company details. */
export function canViewCompanyDetails(
  user: SessionUser | null | undefined,
): boolean {
  if (!user) return false;
  return (
    user.role === "owner" ||
    user.role === "finance_manager" ||
    user.role === "manager"
  );
}

/** Owner and finance manager can edit company details. Manager is read-only. */
export function canManageCompanyDetails(
  user: SessionUser | null | undefined,
): boolean {
  if (!user) return false;
  return user.role === "owner" || user.role === "finance_manager";
}
