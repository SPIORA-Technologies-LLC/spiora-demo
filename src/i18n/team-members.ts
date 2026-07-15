import type { AppLocale } from "./config";
import { translateMessage } from "./messages";

export function translateTeamMemberName(
  locale: AppLocale,
  memberId: string,
  fallback?: string,
): string {
  const localized = translateMessage(locale, `teamMembers.${memberId}`);
  if (localized !== `teamMembers.${memberId}`) {
    return localized;
  }
  return fallback ?? memberId;
}
