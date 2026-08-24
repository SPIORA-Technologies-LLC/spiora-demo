import "server-only";

import { listAllTeamUsers, getDeletedUserIds } from "@/lib/team/store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { sbListActiveUserProfiles } from "@/lib/supabase/user-profiles-repo";

export async function listActiveCalendarUserIds(): Promise<string[]> {
  const deleted = new Set(await getDeletedUserIds());
  const ids = new Set<string>();

  for (const user of await listAllTeamUsers()) {
    if (!deleted.has(user.id)) {
      ids.add(user.id);
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const profiles = await sbListActiveUserProfiles();
      for (const profile of profiles) {
        if (!deleted.has(profile.id)) {
          ids.add(profile.id);
        }
      }
    } catch (error) {
      console.error("[calendar] list active users", error);
    }
  }

  return [...ids];
}
