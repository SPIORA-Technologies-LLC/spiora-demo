import type { SignVersionStatus } from "../sign-types";

const ALLOWED: Record<SignVersionStatus, readonly SignVersionStatus[]> = {
  draft: ["awaiting_client_signature", "cancelled"],
  awaiting_client_signature: ["client_signed", "cancelled", "superseded", "expired"],
  client_signed: ["provider_signed", "cancelled", "superseded"],
  provider_signed: ["completed", "cancelled"],
  completed: ["cancelled"],
  expired: ["superseded"],
  cancelled: [],
  superseded: [],
};

export function canTransition(
  from: SignVersionStatus,
  to: SignVersionStatus,
): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(
  from: SignVersionStatus,
  to: SignVersionStatus,
): void {
  if (!canTransition(from, to)) {
    const error = new Error("CONTRACT_WRONG_STATUS");
    error.name = "SignStatusError";
    throw error;
  }
}

export function isTerminalStatus(status: SignVersionStatus): boolean {
  return (
    status === "completed" ||
    status === "cancelled" ||
    status === "superseded"
  );
}

export function isImmutableStatus(status: SignVersionStatus): boolean {
  return status === "client_signed" || status === "provider_signed" || status === "completed";
}

export function isSignableByClient(status: SignVersionStatus): boolean {
  return status === "awaiting_client_signature";
}

export function isSignableByProvider(status: SignVersionStatus): boolean {
  return status === "client_signed";
}

export function clientHasSigned(status: SignVersionStatus): boolean {
  return (
    status === "client_signed" ||
    status === "provider_signed" ||
    status === "completed"
  );
}

export function bothPartiesSigned(status: SignVersionStatus): boolean {
  return status === "provider_signed" || status === "completed";
}
