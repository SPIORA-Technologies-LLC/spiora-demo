import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TeamUser } from "@/lib/auth/users";
import { getAppState, setAppState } from "@/lib/supabase/app-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const STORE_PATH = path.join(process.cwd(), ".data", "team-custom-users.json");
const APP_STATE_KEY = "team_custom_users";

export type CustomTeamMember = {
  id: string;
  email: string;
  name: string;
  role: "manager";
  createdAt: string;
  createdByUserId: string;
};

type CustomUsersStore = {
  members: CustomTeamMember[];
};

const EMPTY_STORE: CustomUsersStore = { members: [] };

async function readFileStore(): Promise<CustomUsersStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const data = JSON.parse(raw) as CustomUsersStore;
    if (!Array.isArray(data.members)) {
      return EMPTY_STORE;
    }
    return data;
  } catch {
    return EMPTY_STORE;
  }
}

async function writeFileStore(store: CustomUsersStore): Promise<void> {
  await mkdir(path.dirname(STORE_PATH), { recursive: true });
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

async function readStore(): Promise<CustomUsersStore> {
  if (isSupabaseConfigured()) {
    try {
      const value = await getAppState<CustomUsersStore>(APP_STATE_KEY);
      return value?.members ? value : EMPTY_STORE;
    } catch (error) {
      console.error("[team/custom-users] supabase read", error);
      return EMPTY_STORE;
    }
  }
  return readFileStore();
}

async function writeStore(store: CustomUsersStore): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return setAppState(APP_STATE_KEY, store);
  }
  try {
    await writeFileStore(store);
    return true;
  } catch (error) {
    console.error("[team/custom-users] file write", error);
    return false;
  }
}

function toTeamUser(member: CustomTeamMember): TeamUser {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    passwordEnvKey: "",
  };
}

export function slugifyTeamMemberId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "manager"}-${suffix}`;
}

export async function listCustomTeamMembers(): Promise<CustomTeamMember[]> {
  const store = await readStore();
  return store.members;
}

export async function listCustomTeamUsers(): Promise<TeamUser[]> {
  return (await listCustomTeamMembers()).map(toTeamUser);
}

export async function findCustomUserByEmail(
  email: string,
): Promise<TeamUser | undefined> {
  const normalized = email.trim().toLowerCase();
  const member = (await listCustomTeamMembers()).find(
    (item) => item.email.toLowerCase() === normalized,
  );
  return member ? toTeamUser(member) : undefined;
}

export async function findCustomUserById(
  id: string,
): Promise<TeamUser | undefined> {
  const member = (await listCustomTeamMembers()).find((item) => item.id === id);
  return member ? toTeamUser(member) : undefined;
}

export async function addCustomTeamMember(
  member: CustomTeamMember,
): Promise<boolean> {
  const store = await readStore();
  if (store.members.some((item) => item.id === member.id)) {
    return false;
  }
  if (
    store.members.some(
      (item) => item.email.toLowerCase() === member.email.toLowerCase(),
    )
  ) {
    return false;
  }
  store.members.push(member);
  return writeStore(store);
}

export async function removeCustomTeamMember(id: string): Promise<boolean> {
  const store = await readStore();
  const next = store.members.filter((item) => item.id !== id);
  if (next.length === store.members.length) {
    return false;
  }
  return writeStore({ members: next });
}
