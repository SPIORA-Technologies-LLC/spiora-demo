import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function moduleDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
}

function firstExisting(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const FULL = "spiora-logo.png";
const COMPACT = "spiora-logo-compact.png";

export function resolveSignPdfLogoPath(): string | null {
  return firstExisting([
    path.join(moduleDir(), "assets", FULL),
    path.join(process.cwd(), "src/lib/client-portal/sign/assets", FULL),
    path.join(process.cwd(), "lib/client-portal/sign/assets", FULL),
    path.join(process.cwd(), "public/logo3.png"),
  ]);
}

export function resolveSignPdfCompactLogoPath(): string | null {
  return (
    firstExisting([
      path.join(moduleDir(), "assets", COMPACT),
      path.join(process.cwd(), "src/lib/client-portal/sign/assets", COMPACT),
      path.join(process.cwd(), "lib/client-portal/sign/assets", COMPACT),
      path.join(process.cwd(), "public/logo3-compact.png"),
    ]) ?? resolveSignPdfLogoPath()
  );
}

export const SIGN_PDF_LOGO_ASPECT = 600 / 130;
export const SIGN_PDF_LOGO_COMPACT_ASPECT = 600 / 82;
