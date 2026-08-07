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

/**
 * auth-js getAuthenticatorAssuranceLevel() WITHOUT a JWT reads
 * session.user.factors from the cookie/JWT session. After signInWithPassword
 * that array is often empty even when auth.mfa_factors has verified TOTP,
 * so nextLevel stays aal1 and MFA challenge is skipped.
 *
 * When callers know verified factor count (listFactors / getUser), reconcile
 * nextLevel before needsMfaChallenge().
 */
export function reconcileAalWithVerifiedFactors(
  aal: MfaAssuranceSnapshot | null,
  verifiedFactorCount: number,
): MfaAssuranceSnapshot | null {
  if (!aal) return null;
  if (aal.currentLevel === "aal2") return aal;
  if (aal.currentLevel !== "aal1") return aal;
  if (aal.nextLevel === "aal2") return aal;
  if (verifiedFactorCount <= 0) return aal;
  return {
    currentLevel: "aal1",
    nextLevel: "aal2",
  };
}
