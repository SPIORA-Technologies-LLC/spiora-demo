export type MfaAssuranceSnapshot = {
  currentLevel: string | null;
  nextLevel: string | null;
};

/**
 * Supabase signals verified MFA factors when nextLevel is aal2 while current is aal1.
 * Recovery must NEVER fake this — only real challenge verify upgrades AAL.
 */
export function needsMfaChallenge(aal: MfaAssuranceSnapshot | null): boolean {
  if (!aal) return false;
  return aal.currentLevel === "aal1" && aal.nextLevel === "aal2";
}

export function isAal2(aal: MfaAssuranceSnapshot | null): boolean {
  return aal?.currentLevel === "aal2";
}
