import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export function generateOtpDigits(
  rng: (size: number) => Buffer = randomBytes,
): string {
  const n = rng(4).readUInt32BE(0) % 1_000_000;
  return String(n).padStart(6, "0");
}

export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code.trim(), BCRYPT_ROUNDS);
}

export async function verifyOtpHash(
  code: string,
  codeHash: string,
): Promise<boolean> {
  if (!code.trim() || !codeHash) return false;
  try {
    return await bcrypt.compare(code.trim(), codeHash);
  } catch {
    return false;
  }
}

export function isOtpExpired(expiresAtIso: string, now = new Date()): boolean {
  return new Date(expiresAtIso).getTime() <= now.getTime();
}
