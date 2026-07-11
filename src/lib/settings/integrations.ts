import { branding } from "@/config/branding";
import {
  areGoogleIntegrationsEnabled,
  areWebhooksIntegrationEnabled,
  isExternalAiIntegrationEnabled,
  isLiveKitIntegrationEnabled,
  isSupabaseIntegrationEnabled,
} from "@/lib/demo/integration-policy";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type IntegrationStatusKey =
  | "demoMode"
  | "disabled"
  | "notConnected"
  | "customDeployment";

export type IntegrationKey =
  | "googleDrive"
  | "googleSheets"
  | "supabase"
  | "livekit"
  | "webhooks"
  | "externalAi";

export type IntegrationStatuses = Record<IntegrationKey, IntegrationStatusKey>;

export function getIntegrationStatuses(): IntegrationStatuses {
  const googleEnabled = areGoogleIntegrationsEnabled();
  const supabaseEnabled = isSupabaseIntegrationEnabled();
  const supabaseConfigured = isSupabaseConfigured();
  const liveKitEnabled = isLiveKitIntegrationEnabled();
  const webhooksEnabled = areWebhooksIntegrationEnabled();
  const externalAiEnabled = isExternalAiIntegrationEnabled();

  return {
    googleDrive: googleEnabled ? "customDeployment" : "notConnected",
    googleSheets: googleEnabled ? "customDeployment" : "notConnected",
    supabase: supabaseConfigured
      ? "customDeployment"
      : supabaseEnabled
        ? "notConnected"
        : "demoMode",
    livekit: liveKitEnabled ? "customDeployment" : "disabled",
    webhooks: webhooksEnabled ? "customDeployment" : "disabled",
    externalAi: externalAiEnabled ? "customDeployment" : "demoMode",
  };
}

export function getDemoCompanyWebsite(): string {
  return branding.demoCompanyWebsiteUrl;
}
