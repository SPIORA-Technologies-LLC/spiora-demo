import { createHash } from "node:crypto";

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function hashSignEvent(input: {
  transactionId: string;
  eventType: string;
  actorUserId: string | null;
  actorType: string;
  documentHash: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
  previousEventHash: string;
}): string {
  const canonical = canonicalize({
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    documentHash: input.documentHash,
    eventType: input.eventType,
    metadata: input.metadata,
    occurredAt: input.occurredAt,
    transactionId: input.transactionId,
  });
  return sha256Hex(`${canonical}${input.previousEventHash}`);
}

export const GENESIS_EVENT_HASH = "0".repeat(64);
