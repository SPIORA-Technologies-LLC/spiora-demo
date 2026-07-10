import type { AppLocale } from "@/i18n/config";
import { translateTeamChatMessage } from "@/i18n/team-chat-messages";

export const DEMO_MESSAGE_PREFIX = "demo:";

export function isDemoMessageText(text: string): boolean {
  return text.startsWith(DEMO_MESSAGE_PREFIX);
}

export function resolveDemoMessageText(
  locale: AppLocale,
  text: string,
): string {
  if (!isDemoMessageText(text)) {
    return text;
  }
  const key = text.slice(DEMO_MESSAGE_PREFIX.length);
  return translateTeamChatMessage(locale, `demoMessages.${key}`);
}
