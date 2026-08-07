/**
 * Optional Client TOTP MFA feature flag (Phase D3).
 * Default OFF. SPIORA_MFA_CLIENT=true opens self-service enroll;
 * enforcement applies only when a verified TOTP factor exists.
 * Does NOT mean mandatory enrollment.
 */
export function isClientMfaEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.SPIORA_MFA_CLIENT?.trim().toLowerCase() === "true";
}
