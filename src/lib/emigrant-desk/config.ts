import { isEmigrantDeskIntegrationEnabled } from "@/lib/demo/integration-policy";

export function isEmigrantDeskConfigured(): boolean {
  if (!isEmigrantDeskIntegrationEnabled()) {
    return false;
  }

  return Boolean(
    process.env.EMIGRANT_SUPABASE_URL?.trim() &&
      process.env.EMIGRANT_SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}
