import "server-only";

import {
  isProfileAccessAllowed,
  sbGetUserProfileByAuthUserId,
} from "@/lib/supabase/user-profiles-repo";
import { sbGetClientPortalUserByAuthUserId } from "@/lib/supabase/client-portal-users-repo";
import type { PasswordRecoveryAudience } from "./password-recovery-gate";

export type PasswordPlaneResolution =
  | { ok: true; audience: PasswordRecoveryAudience }
  | {
      ok: false;
      reason: "missing" | "ambiguous" | "wrong_plane" | "inactive";
    };

/**
 * Resolve auth user to exactly one active application plane.
 * Fail closed on dual profile / missing / inactive.
 */
export async function resolvePasswordPlaneForAudience(
  authUserId: string,
  expected: PasswordRecoveryAudience,
): Promise<PasswordPlaneResolution> {
  const [employee, client] = await Promise.all([
    sbGetUserProfileByAuthUserId(authUserId).catch(() => null),
    sbGetClientPortalUserByAuthUserId(authUserId).catch(() => null),
  ]);

  const employeeActive = employee && isProfileAccessAllowed(employee);
  const clientActive = Boolean(client);

  if (employeeActive && clientActive) {
    return { ok: false, reason: "ambiguous" };
  }

  if (expected === "employee") {
    if (clientActive && !employeeActive) {
      return { ok: false, reason: "wrong_plane" };
    }
    if (!employee) return { ok: false, reason: "missing" };
    if (!employeeActive) return { ok: false, reason: "inactive" };
    return { ok: true, audience: "employee" };
  }

  if (employeeActive && !clientActive) {
    return { ok: false, reason: "wrong_plane" };
  }
  if (!client) return { ok: false, reason: "missing" };
  if (!clientActive) return { ok: false, reason: "inactive" };
  return { ok: true, audience: "client" };
}
