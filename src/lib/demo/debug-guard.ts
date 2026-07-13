import "server-only";

import { isDemoMode } from "@/lib/demo/demo-mode";

/** Debug routes and panels are fully disabled in public demo mode. */
export function areDebugFeaturesEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true") {
    return false;
  }
  return true;
}

export function isDebugClientCommandAllowed(): boolean {
  return areDebugFeaturesEnabled();
}

export function isDebugApiAllowed(): boolean {
  return areDebugFeaturesEnabled();
}

export function isDemoModeActive(): boolean {
  return isDemoMode();
}
