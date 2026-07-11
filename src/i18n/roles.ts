import type { AppLocale } from "./config";
import type { UserRole } from "@/lib/auth/types";
import { translateMemberStatus, translateUserRole } from "./admin-messages";

export type MemberStatus = "active" | "inactive" | "invited" | "suspended";

export function translateRole(locale: AppLocale, role: UserRole): string {
  return translateUserRole(locale, role);
}

export function translateStatus(
  locale: AppLocale,
  status: MemberStatus,
): string {
  return translateMemberStatus(locale, status);
}
