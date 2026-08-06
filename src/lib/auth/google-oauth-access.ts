import { isClientPortalLocale } from "@/lib/client-portal/types";
import { isUserRole } from "@/lib/auth/users";
import { getCanonicalAppOrigin } from "@/lib/auth/canonical-app-origin";

export type GoogleOAuthAudience = "employee" | "client";

export type GoogleOAuthDenyReason =
  | "missing"
  | "inactive"
  | "unsupported_role"
  | "client_profile_present"
  | "employee_profile_present"
  | "ambiguous"
  | "invalid_locale"
  | "incomplete_portal_row";

/** Minimal employee shape — same gates as evaluateProfileAccess + profileToSessionUser. */
export type GoogleOAuthEmployeeView = {
  status: string;
  archivedAt: string | null;
  role: string;
};

/** Minimal client shape — same gates as getClientSession mapSession. */
export type GoogleOAuthClientView = {
  preferredLocale: string;
  invitationId: string;
};

/**
 * Fixed app redirects — never taken from query/body.
 */
export function googleOAuthSuccessPath(audience: GoogleOAuthAudience): string {
  return audience === "employee" ? "/dashboard" : "/client?enter=1";
}

export function googleOAuthDenyPath(audience: GoogleOAuthAudience): string {
  return audience === "employee"
    ? "/login?error=google_access_denied"
    : "/client/login?error=google_access_denied";
}

export function buildGoogleOAuthCallbackUrl(
  audience: GoogleOAuthAudience,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const origin = getCanonicalAppOrigin(env);
  if (!origin) return null;
  return `${origin}/auth/callback/${audience}`;
}

function isEmployeeAccessAllowed(profile: GoogleOAuthEmployeeView): boolean {
  if (profile.status === "suspended") return false;
  if (profile.status === "archived" || profile.archivedAt) return false;
  if (profile.status !== "active") return false;
  return isUserRole(profile.role);
}

/**
 * Same production gates as password login / getClientSession — no invented "active" column.
 * Dual membership (any row on the other plane) fails closed.
 */
export function evaluateGoogleOAuthAccess(input: {
  audience: GoogleOAuthAudience;
  employee: GoogleOAuthEmployeeView | null;
  client: GoogleOAuthClientView | null;
}): { ok: true } | { ok: false; reason: GoogleOAuthDenyReason } {
  const { audience, employee, client } = input;

  if (employee && client) {
    return { ok: false, reason: "ambiguous" };
  }

  if (audience === "employee") {
    if (client) {
      return { ok: false, reason: "client_profile_present" };
    }
    if (!employee) {
      return { ok: false, reason: "missing" };
    }
    if (!isEmployeeAccessAllowed(employee)) {
      return {
        ok: false,
        reason: isUserRole(employee.role) ? "inactive" : "unsupported_role",
      };
    }
    return { ok: true };
  }

  if (employee) {
    return { ok: false, reason: "employee_profile_present" };
  }
  if (!client) {
    return { ok: false, reason: "missing" };
  }
  if (!client.invitationId?.trim()) {
    return { ok: false, reason: "incomplete_portal_row" };
  }
  if (!isClientPortalLocale(client.preferredLocale)) {
    return { ok: false, reason: "invalid_locale" };
  }
  return { ok: true };
}
