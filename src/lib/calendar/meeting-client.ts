export {
  formatMeetingOpensAtLabel,
  getMeetingAccessPhase,
  getMeetingAccessWindow,
  isWithinMeetingWindow,
  MEETING_EARLY_MINUTES,
  MEETING_LATE_MINUTES,
  type MeetingAccessPhase,
} from "./meeting-window";

import type { AppLocale } from "@/i18n/config";
import { translateMeetingStatus } from "@/i18n/calendar-enums";
import type { MeetingAccessPhase } from "./meeting-window";

export function formatMeetingStatusLabel(
  phase: MeetingAccessPhase,
  locale: AppLocale = "en",
): string {
  return translateMeetingStatus(locale, phase);
}
