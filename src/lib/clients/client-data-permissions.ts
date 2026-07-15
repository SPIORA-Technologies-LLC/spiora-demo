import type { SessionUser } from "@/lib/auth/types";

export function canReadClientNotes(_user: SessionUser): boolean {
  return true;
}

export function canCreateClientNote(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canUpdateClientNote(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canArchiveClientNote(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canReadClientDocuments(_user: SessionUser): boolean {
  return true;
}

export function canCreateClientDocument(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canUpdateClientDocument(user: SessionUser): boolean {
  return user.role === "owner" || user.role === "manager";
}

export function canArchiveClientDocument(user: SessionUser): boolean {
  return user.role === "owner";
}
