import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function moduleFontDir(): string {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return __dirname;
  }
}

const BUNDLED = "NotoSans-Regular.ttf";

const CANDIDATES = [
  path.join(moduleFontDir(), "fonts", BUNDLED),
  path.join(process.cwd(), "src/lib/client-portal/sign/fonts", BUNDLED),
  path.join(process.cwd(), "lib/client-portal/sign/fonts", BUNDLED),
  "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
];

export function resolveSignPdfFontPath(): string {
  for (const candidate of CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("SIGN_FONT_MISSING");
}
