import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setUserPassword, validateNewPassword } from "@/lib/auth/password-store";
import type { SessionUser } from "@/lib/auth/types";
import {
  findUserByEmail,
  listTeamUsers,
  type TeamUser,
} from "@/lib/auth/users";
import { getAppState, setAppState } from "@/lib/supabase/app-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  addCustomTeamMember,
  findCustomUserByEmail,
  findCustomUserById,
  listCustomTeamUsers,
  removeCustomTeamMember,
  slugifyTeamMemberId,
} from "./custom-users";
import { canDeleteTeamMember, canManageTeam } from "./permissions";
import type { TeamMember } from "./types";

const STORE_PATH = path.join(process.cwd(), ".data", "team-deleted-users.json");
const APP_STATE_KEY = "team_deleted_user_ids";

type DeletedUsersStore = {
  userIds: string[];
};

const DEFAULT_STORE: DeletedUsersStore = { userIds: [] };

async function readStoreFromFile(): Promise<DeletedUsersStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as DeletedUsersStore;
    if (!Array.isArray(data.userIds)) {
      return DEFAULT_STORE;
    }
    return data;
  } catch {
    return DEFAULT_STORE;
  }
}

async function writeStoreToFile(store: DeletedUsersStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function readStore(): Promise<DeletedUsersStore> {
  if (isSupabaseConfigured()) {
    try {
      const value = await getAppState<DeletedUsersStore>(APP_STATE_KEY);
      return value ?? DEFAULT_STORE;
    } catch (error) {
      console.error("[team] supabase read", error);
      return DEFAULT_STORE;
    }
  }
  return readStoreFromFile();
}

async function writeStore(store: DeletedUsersStore): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return setAppState(APP_STATE_KEY, store);
  }
  try {
    await writeStoreToFile(store);
    return true;
  } catch (error) {
    console.error("[team] file write", error);
    return false;
  }
}

export async function getDeletedUserIds(): Promise<string[]> {
  const store = await readStore();
  return store.userIds;
}

export async function isUserDeleted(userId: string): Promise<boolean> {
  const ids = await getDeletedUserIds();
  return ids.includes(userId);
}

export async function listAllTeamUsers(): Promise<TeamUser[]> {
  const custom = await listCustomTeamUsers();
  return [...listTeamUsers(), ...custom];
}

export async function findTeamUserByEmail(
  email: string,
): Promise<TeamUser | undefined> {
  return findUserByEmail(email) ?? (await findCustomUserByEmail(email));
}

export async function findTeamUserById(
  id: string,
): Promise<TeamUser | undefined> {
  return (
    listTeamUsers().find((user) => user.id === id) ??
    (await findCustomUserById(id))
  );
}

export async function listTeamMembers(): Promise<TeamMember[]> {
  const deleted = new Set(await getDeletedUserIds());
  const users = await listAllTeamUsers();
  return users
    .filter((user) => !deleted.has(user.id))
    .map(({ id, email, name, role }) => ({ id, email, name, role }));
}

export type TeamDeleteErrorCode =
  | "deleteForbidden"
  | "notFound"
  | "alreadyDeleted"
  | "saveFailed";

export async function deleteTeamMember(
  actor: SessionUser,
  targetId: string,
): Promise<{ ok: true } | { ok: false; error: TeamDeleteErrorCode }> {
  const target = await findTeamUserById(targetId);
  if (!target) {
    return { ok: false, error: "notFound" };
  }

  if (!canDeleteTeamMember(actor, target)) {
    return { ok: false, error: "deleteForbidden" };
  }

  const isCustom = Boolean(await findCustomUserById(targetId));
  if (isCustom) {
    const removed = await removeCustomTeamMember(targetId);
    if (!removed) {
      return { ok: false, error: "saveFailed" };
    }
    return { ok: true };
  }

  const store = await readStore();
  if (store.userIds.includes(targetId)) {
    return { ok: false, error: "alreadyDeleted" };
  }

  const saved = await writeStore({
    userIds: [...store.userIds, targetId],
  });

  if (!saved) {
    return { ok: false, error: "saveFailed" };
  }

  return { ok: true };
}

export type TeamCreateErrorCode =
  | "createForbidden"
  | "invalidName"
  | "invalidEmail"
  | "invalidPassword"
  | "emailTaken"
  | "saveFailed";

export async function createTeamManager(
  actor: SessionUser,
  input: { name: string; email: string; password: string },
): Promise<
  | { ok: true; member: TeamMember; password: string }
  | { ok: false; error: TeamCreateErrorCode; detail?: string }
> {
  if (!canManageTeam(actor)) {
    return { ok: false, error: "createForbidden" };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: "invalidName" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalidEmail" };
  }

  const passwordError = validateNewPassword(password);
  if (passwordError) {
    return { ok: false, error: "invalidPassword", detail: passwordError };
  }

  const existing = await findTeamUserByEmail(email);
  if (existing && !(await isUserDeleted(existing.id))) {
    return { ok: false, error: "emailTaken" };
  }

  const id = slugifyTeamMemberId(name);
  const createdAt = new Date().toISOString();
  const saved = await addCustomTeamMember({
    id,
    email,
    name,
    role: "manager",
    createdAt,
    createdByUserId: actor.id,
  });

  if (!saved) {
    return { ok: false, error: "emailTaken" };
  }

  try {
    await setUserPassword({
      userId: id,
      password,
      updatedByUserId: actor.id,
      updatedByName: actor.name,
    });
  } catch {
    await removeCustomTeamMember(id);
    return { ok: false, error: "saveFailed" };
  }

  return {
    ok: true,
    member: { id, email, name, role: "manager" },
    password,
  };
}
