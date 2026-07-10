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
