import { isSupabaseIntegrationEnabled } from "@/lib/demo/integration-policy";

export function isSupabaseConfigured(): boolean {
  if (!isSupabaseIntegrationEnabled()) {
    return false;
  }

  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/** Anon/publishable key present — required for Supabase Auth user sessions. */
export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return Boolean(url && anon);
}
