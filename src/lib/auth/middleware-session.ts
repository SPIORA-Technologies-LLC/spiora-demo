import { createClient } from "@supabase/supabase-js";
import type { SessionUser } from "./types";
import { isUserRole } from "./users";

type ProfileRow = {
  id: string;
  auth_user_id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  language: string | null;
  timezone: string | null;
  archived_at: string | null;
};

/**
 * Middleware-safe profile → session mapping.
 * Uses service role only on the server/edge boundary; never shipped to browser.
 * Kept free of `server-only` so Next middleware can import it.
 */
export async function resolveSessionFromAuthUserId(
  authUserId: string | null | undefined,
): Promise<SessionUser | null> {
  if (!authUserId) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        "id, auth_user_id, email, display_name, role, status, language, timezone, archived_at",
      )
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as ProfileRow;
    if (row.status !== "active" || row.archived_at) return null;
    if (!isUserRole(row.role)) return null;

    return {
      id: row.id,
      authUserId: row.auth_user_id,
      email: row.email,
      name: row.display_name,
      role: row.role,
      status: "active",
      language: row.language === "ru" ? "ru" : "en",
      timezone: row.timezone || "UTC",
    };
  } catch {
    return null;
  }
}
