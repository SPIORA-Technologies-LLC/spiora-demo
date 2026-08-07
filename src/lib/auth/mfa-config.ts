/**
 * Employee TOTP MFA feature flag.
 * Default OFF until production smoke; enable with SPIORA_MFA_EMPLOYEE=true.
 */
export const MFA_MAX_VERIFIED_TOTP_FACTORS = 1;
export const MFA_RECOVERY_CODE_COUNT = 10;

export function isEmployeeMfaEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return env.SPIORA_MFA_EMPLOYEE?.trim().toLowerCase() === "true";
}
