import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAppState, setAppState } from "@/lib/supabase/app-state";

const HIDDEN_KEY = "client_invitations_hidden_ids";
const LOCAL_HIDDEN_FILE = path.join(
  process.cwd(),
  ".data",
  "client-invitations-hidden.json",
);

async function readLocalHidden(): Promise<string[]> {
  try {
    const raw = await fs.readFile(LOCAL_HIDDEN_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeLocalHidden(ids: string[]): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_HIDDEN_FILE), { recursive: true });
  await fs.writeFile(LOCAL_HIDDEN_FILE, JSON.stringify(ids, null, 2), "utf8");
}

export async function listHiddenInvitationIds(): Promise<Set<string>> {
  if (isSupabaseConfigured()) {
    const value = await getAppState<string[]>(HIDDEN_KEY);
    return new Set(Array.isArray(value) ? value : []);
  }
  return new Set(await readLocalHidden());
}

export async function hideInvitationFromStaffList(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const current = await getAppState<string[]>(HIDDEN_KEY);
    const next = Array.from(
      new Set([...(Array.isArray(current) ? current : []), id]),
    );
    return setAppState(HIDDEN_KEY, next);
  }

  const next = Array.from(new Set([...(await readLocalHidden()), id]));
  await writeLocalHidden(next);
  return true;
}
