import { randomUUID } from "node:crypto";

export function createSignTransactionId(): string {
  return `SP-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}

export function createDisplayAgreementNumber(
  year: number,
  contractId: string,
): string {
  const hex = contractId.replaceAll("-", "").slice(0, 7);
  const n = Number.parseInt(hex, 16) % 10_000_000;
  return `SP-${year}-${String(Number.isFinite(n) ? n : 0).padStart(7, "0")}`;
}
