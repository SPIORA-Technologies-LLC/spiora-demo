import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ClientPortalLocale } from "./types";
import type { ClientInvitationState } from "./invite-token";
import { computeInvitationState } from "./invite-token";

const DATA_DIR = path.join(process.cwd(), ".data");
const INVITES_FILE = path.join(DATA_DIR, "client-invitations.json");
const PORTAL_USERS_FILE = path.join(DATA_DIR, "client-portal-users.json");

export type LocalInvitationRow = {
  id: string;
  email: string;
  firstName: string | null;
  tokenHash: string;
  preferredLocale: ClientPortalLocale;
  serviceType: string | null;
  assignedTo: string | null;
  questionnaireTemplateKey: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  acceptedByUserId: string | null;
  createdBy: string;
  createRequestId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalPortalUserRow = {
  id: string;
  authUserId: string;
  email: string;
  preferredLocale: ClientPortalLocale;
  invitationId: string;
  mfaReenrollRequired?: boolean;
  createdAt: string;
  updatedAt: string;
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function localListInvitations(): Promise<LocalInvitationRow[]> {
  const rows = await readJson<Array<Partial<LocalInvitationRow> & { id: string }>>(
    INVITES_FILE,
    [],
  );
  return rows
    .map((r) => ({
      ...(r as LocalInvitationRow),
      firstName: r.firstName ?? null,
    }))
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function localFindInvitationByRequestId(
  createdBy: string,
  requestId: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  return (
    rows.find(
      (r) => r.createdBy === createdBy && r.createRequestId === requestId,
    ) ?? null
  );
}

export async function localFindInvitationByTokenHash(
  tokenHash: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  return rows.find((r) => r.tokenHash === tokenHash) ?? null;
}

export async function localFindInvitationById(
  id: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  return rows.find((r) => r.id === id) ?? null;
}

export async function localInsertInvitation(
  input: Omit<LocalInvitationRow, "id" | "createdAt" | "updatedAt" | "acceptedAt" | "revokedAt" | "acceptedByUserId"> & {
    id?: string;
  },
): Promise<LocalInvitationRow> {
  const rows = await localListInvitations();
  const now = new Date().toISOString();
  const row: LocalInvitationRow = {
    id: input.id ?? randomUUID(),
    email: input.email,
    firstName: input.firstName ?? null,
    tokenHash: input.tokenHash,
    preferredLocale: input.preferredLocale,
    serviceType: input.serviceType,
    assignedTo: input.assignedTo,
    questionnaireTemplateKey: input.questionnaireTemplateKey,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    revokedAt: null,
    acceptedByUserId: null,
    createdBy: input.createdBy,
    createRequestId: input.createRequestId,
    createdAt: now,
    updatedAt: now,
  };
  rows.unshift(row);
  await writeJson(INVITES_FILE, rows);
  return row;
}

export async function localUpdateInvitationFirstName(
  id: string,
  firstName: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const row = rows[idx]!;
  const next: LocalInvitationRow = {
    ...row,
    firstName,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  await writeJson(INVITES_FILE, rows);
  return next;
}

export async function localRotateInvitationToken(
  id: string,
  tokenHash: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const row = rows[idx]!;
  const state = computeInvitationState(row);
  if (state !== "pending") return null;
  const updated: LocalInvitationRow = {
    ...row,
    tokenHash,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = updated;
  await writeJson(INVITES_FILE, rows);
  return updated;
}

export async function localRevokeInvitation(
  id: string,
): Promise<LocalInvitationRow | null> {
  const rows = await localListInvitations();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const row = rows[idx]!;
  const state = computeInvitationState(row);
  if (state === "accepted") return row;
  if (row.revokedAt) return row;
  const updated: LocalInvitationRow = {
    ...row,
    revokedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = updated;
  await writeJson(INVITES_FILE, rows);
  return updated;
}

export async function localAcceptInvitation(input: {
  invitationId: string;
  authUserId: string;
  email: string;
  preferredLocale: ClientPortalLocale;
}): Promise<{ invitation: LocalInvitationRow; portalUser: LocalPortalUserRow }> {
  const invites = await localListInvitations();
  const idx = invites.findIndex((r) => r.id === input.invitationId);
  if (idx < 0) throw new Error("invitation_not_found");
  const invite = invites[idx]!;

  const users = await readJson<LocalPortalUserRow[]>(PORTAL_USERS_FILE, []);
  const existingByAuth = users.find((u) => u.authUserId === input.authUserId);
  if (existingByAuth && existingByAuth.invitationId === invite.id) {
    return { invitation: invite, portalUser: existingByAuth };
  }
  if (existingByAuth) {
    const sameEmail =
      existingByAuth.email.trim().toLowerCase() ===
      input.email.trim().toLowerCase();
    if (!sameEmail) {
      throw new Error("portal_user_other_invite");
    }
    // Rebind after staff delete / invite-again (mirrors Supabase path).
    const state = computeInvitationState(invite);
    if (state === "revoked") throw new Error("invitation_revoked");
    if (state === "expired") throw new Error("invitation_expired");
    if (state === "accepted") {
      if (invite.acceptedByUserId === input.authUserId) {
        return { invitation: invite, portalUser: existingByAuth };
      }
      throw new Error("invitation_accepted");
    }
    const now = new Date().toISOString();
    const updatedInvite: LocalInvitationRow = {
      ...invite,
      acceptedAt: now,
      acceptedByUserId: input.authUserId,
      updatedAt: now,
    };
    invites[idx] = updatedInvite;
    const rebound: LocalPortalUserRow = {
      ...existingByAuth,
      invitationId: invite.id,
      preferredLocale: input.preferredLocale,
      updatedAt: now,
    };
    const uIdx = users.findIndex((u) => u.id === existingByAuth.id);
    if (uIdx >= 0) users[uIdx] = rebound;
    await writeJson(INVITES_FILE, invites);
    await writeJson(PORTAL_USERS_FILE, users);
    return { invitation: updatedInvite, portalUser: rebound };
  }

  if (invite.acceptedAt && invite.acceptedByUserId === input.authUserId) {
    const portal = users.find((u) => u.invitationId === invite.id);
    if (portal) return { invitation: invite, portalUser: portal };
  }

  const state = computeInvitationState(invite);
  if (state === "revoked") throw new Error("invitation_revoked");
  if (state === "expired") throw new Error("invitation_expired");
  if (state === "accepted") throw new Error("invitation_accepted");

  const now = new Date().toISOString();
  const updatedInvite: LocalInvitationRow = {
    ...invite,
    acceptedAt: now,
    acceptedByUserId: input.authUserId,
    updatedAt: now,
  };
  invites[idx] = updatedInvite;

  const portalUser: LocalPortalUserRow = {
    id: randomUUID(),
    authUserId: input.authUserId,
    email: input.email,
    preferredLocale: input.preferredLocale,
    invitationId: invite.id,
    createdAt: now,
    updatedAt: now,
  };
  users.push(portalUser);

  await writeJson(INVITES_FILE, invites);
  await writeJson(PORTAL_USERS_FILE, users);
  return { invitation: updatedInvite, portalUser };
}

export async function getLocalClientPortalUserByAuthUserId(
  authUserId: string,
): Promise<LocalPortalUserRow | null> {
  const users = await readJson<LocalPortalUserRow[]>(PORTAL_USERS_FILE, []);
  return users.find((u) => u.authUserId === authUserId) ?? null;
}

export async function getLocalClientPortalUserByEmail(
  email: string,
): Promise<LocalPortalUserRow | null> {
  const normalized = email.trim().toLowerCase();
  const users = await readJson<LocalPortalUserRow[]>(PORTAL_USERS_FILE, []);
  return (
    users.find((u) => u.email.trim().toLowerCase() === normalized) ?? null
  );
}

export function localInvitationPublicState(
  row: LocalInvitationRow,
): ClientInvitationState {
  return computeInvitationState(row);
}
