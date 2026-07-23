/**
 * Client portal session types (PR #30).
 * Intentionally separate from employee SessionUser / UserRole.
 */

export type ClientPortalLocale = "en" | "ru";

export type ClientSession = {
  id: string;
  authUserId: string;
  email: string;
  /** First name from auth metadata when available (set at registration). */
  firstName: string | null;
  preferredLocale: ClientPortalLocale;
  invitationId: string;
};

export function isClientPortalLocale(value: string): value is ClientPortalLocale {
  return value === "en" || value === "ru";
}
