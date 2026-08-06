import { isTruthyEnv } from "@/lib/demo/demo-mode";

export type MailConfig = {
  enabled: boolean;
  apiKey: string;
  fromEmail: string;
  fromName: string;
};

/** Parses `Name <email@domain>` or bare `email@domain`. */
export function parseMailFrom(raw: string): {
  email: string;
  name: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const angled = trimmed.match(/^(.+?)\s*<([^<>\s]+)>$/);
  if (angled) {
    const name = angled[1].trim().replace(/^["']|["']$/g, "");
    const email = angled[2].trim().toLowerCase();
    if (!email.includes("@")) return null;
    return { email, name: name || "Spiora" };
  }

  if (!trimmed.includes("@") || trimmed.includes(" ")) return null;
  return { email: trimmed.toLowerCase(), name: "Spiora" };
}

export function getMailConfig(): MailConfig {
  const apiKey =
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim() ||
    "";
  const fromRaw =
    process.env.SPIORA_EMAIL_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    "";
  const parsed = parseMailFrom(fromRaw);
  const enabled =
    isTruthyEnv("SPIORA_ENABLE_EMAIL") &&
    Boolean(apiKey) &&
    Boolean(parsed?.email);

  return {
    enabled,
    apiKey,
    fromEmail: parsed?.email ?? "",
    fromName:
      process.env.SPIORA_EMAIL_FROM_NAME?.trim() || parsed?.name || "Spiora",
  };
}

export function isMailConfigured(): boolean {
  return getMailConfig().enabled;
}
