import type { SessionUser } from "@/lib/auth/types";

export function canReadClients(_user: SessionUser): boolean {
  return true;
}

export function canCreateClient(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canUpdateClient(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canArchiveClient(user: SessionUser): boolean {
  return user.role === "owner";
}
