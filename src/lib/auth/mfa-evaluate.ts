import {
  needsMfaChallenge,
  reconcileAalWithVerifiedFactors,
  type MfaAssuranceSnapshot,
} from "./mfa-aal";

/** Minimal Supabase auth surface used for AAL evaluation. */
export type MfaEvalAuthClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: { access_token: string } | null };
    }>;
    mfa: {
      getAuthenticatorAssuranceLevel: (jwt?: string) => Promise<{
        data: MfaAssuranceSnapshot | null;
        error: unknown;
      }>;
      listFactors: () => Promise<{
        data: { totp: Array<{ id: string }> } | null;
        error: unknown;
      }>;
    };
  };
};

/**
 * Production-fixed AAL read:
 * pass session.access_token into getAuthenticatorAssuranceLevel so auth-js
 * loads factors via getUser(jwt). Fallback: listFactors + reconcile when
 * nextLevel stays aal1 after password/Google (empty session.user.factors).
 */
export async function readMfaAssurance(
  supabase: MfaEvalAuthClient,
): Promise<MfaAssuranceSnapshot | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
    session.access_token,
  );
  if (error || !data) return null;

  let snapshot: MfaAssuranceSnapshot = {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  };

  if (snapshot.currentLevel === "aal1" && snapshot.nextLevel !== "aal2") {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    snapshot = reconcileAalWithVerifiedFactors(
      snapshot,
      factors?.totp?.length ?? 0,
    )!;
  }

  return snapshot;
}

export async function evaluateMfaChallengeRequired(
  supabase: MfaEvalAuthClient,
): Promise<boolean> {
  try {
    const snapshot = await readMfaAssurance(supabase);
    return needsMfaChallenge(snapshot);
  } catch {
    return false;
  }
}
