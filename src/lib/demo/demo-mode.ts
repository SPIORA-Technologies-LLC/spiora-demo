/** Demo mode flag — set SPIORA_DEMO_MODE=true in server environment. */
export function isDemoMode(): boolean {
  return process.env.SPIORA_DEMO_MODE?.trim().toLowerCase() === "true";
}

export function isTruthyEnv(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function parseCsvEnv(name: string): string[] {
  const raw = process.env[name]?.trim();
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
