/**
 * Middleware helper: detect client portal auth without elevating to employee.
 * Uses service role lookup of client_portal_users — never trusts browser metadata alone.
 */

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function resolveClientPortalAccess(
  authUserId: string | null | undefined,
): Promise<boolean> {
  if (!authUserId) return false;
  if (!isSupabaseConfigured()) {
    // Local fallback: dynamic import avoided in edge — middleware uses env check only.
    // Full local portal auth is validated in route handlers / getClientSession.
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return false;

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("client_portal_users")
      .select("id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();
    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}
