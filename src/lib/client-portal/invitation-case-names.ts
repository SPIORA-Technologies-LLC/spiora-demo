import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  resolveInvitationDisplayFirstName,
  toGivenName,
} from "./display-name";

export { resolveInvitationDisplayFirstName };

export async function getCaseFirstNamesByInvitationIds(
  invitationIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(invitationIds.filter(Boolean))];
  if (ids.length === 0) return map;

  if (isSupabaseConfigured()) {
    try {
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from("client_cases")
        .select("invitation_id, first_name")
        .in("invitation_id", ids)
        .is("archived_at", null);
      for (const row of data ?? []) {
        const id =
          typeof row.invitation_id === "string" ? row.invitation_id : "";
        const name =
          typeof row.first_name === "string" ? row.first_name.trim() : "";
        if (id && name) map.set(id, name);
      }
    } catch {
      // non-fatal — list still works with invite-time names
    }
    return map;
  }

  try {
    const file = path.join(process.cwd(), ".data", "client-cases.json");
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as {
      cases?: Array<{
        invitationId?: string;
        firstName?: string | null;
        archivedAt?: string | null;
      }>;
    };
    const idSet = new Set(ids);
    for (const item of parsed.cases ?? []) {
      if (
        item.archivedAt ||
        !item.invitationId ||
        !idSet.has(item.invitationId)
      ) {
        continue;
      }
      const name = item.firstName?.trim();
      if (name) map.set(item.invitationId, name);
    }
  } catch {
    // empty / missing local store
  }

  return map;
}

/** Best-effort: keep invite row aligned with submitted questionnaire given name. */
export async function syncInvitationFirstNameFromCase(
  invitationId: string,
  caseFirstName: string | null | undefined,
): Promise<void> {
  const given = toGivenName(caseFirstName);
  if (!given || !invitationId) return;

  if (isSupabaseConfigured()) {
    try {
      await getSupabaseAdmin()
        .from("client_invitations")
        .update({
          first_name: given,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitationId);
    } catch {
      // non-fatal
    }
    return;
  }

  try {
    const { localUpdateInvitationFirstName } = await import("./local-store");
    await localUpdateInvitationFirstName(invitationId, given);
  } catch {
    // non-fatal
  }
}
