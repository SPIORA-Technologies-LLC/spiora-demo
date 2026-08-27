import "server-only";

import { randomUUID } from "node:crypto";
import {
  CALENDAR_COMPANY_ID,
  CALENDAR_DEFAULT_EVENT_TYPE,
  CALENDAR_DEFAULT_SEND_REMINDERS,
  CALENDAR_TIMEZONE,
} from "./constants";
import { buildDemoEventTitle } from "./demo-event-title";
import { formatDateKey } from "./range";
import { zonedDateTimeToUtc } from "./zoned-time";
import type { CalendarEvent, CalendarEventType, CalendarScope } from "./types";

const DEMO_AUTHORS: Record<string, string> = {
  "olivia-bennett": "Olivia Bennett",
  "daniel-cooper": "Daniel Cooper",
  "emma-wilson": "Emma Wilson",
  "lucas-martin": "Lucas Martin",
};

type DemoEventTemplate = {
  weekOffset: number;
  weekday: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  titleKey: string;
  scope: CalendarScope;
  eventType?: CalendarEventType;
  allDay?: boolean;
  location?: string;
  description?: string;
  ownerUserId?: string | null;
  createdByUserId: string;
  sendReminders?: boolean;
  linkedClientName?: string;
};

function getMondayOfWeek(reference: Date, timeZone: string): string {
  const anchorKey = formatDateKey(reference, timeZone);
  const anchor = zonedDateTimeToUtc(
    anchorKey,
    { hours: 12, minutes: 0, seconds: 0 },
    timeZone,
  );
  const weekday = anchor.getUTCDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  const monday = new Date(anchor.getTime() + diff * 86_400_000);
  return formatDateKey(monday, timeZone);
}

function addDays(dateKey: string, days: number, timeZone: string): string {
  const anchor = zonedDateTimeToUtc(
    dateKey,
    { hours: 12, minutes: 0, seconds: 0 },
    timeZone,
  );
  return formatDateKey(new Date(anchor.getTime() + days * 86_400_000), timeZone);
}

function toIso(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  return zonedDateTimeToUtc(
    dateKey,
    { hours: hour, minutes: minute, seconds: 0 },
    timeZone,
  ).toISOString();
}

const DEMO_TEMPLATES: DemoEventTemplate[] = [
  { weekOffset: 0, weekday: 0, startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, titleKey: "teamMeeting", scope: "company", createdByUserId: "olivia-bennett" },
  { weekOffset: 0, weekday: 0, startHour: 11, startMinute: 0, endHour: 12, endMinute: 0, titleKey: "clientConsultation", scope: "company", eventType: "video_meeting", createdByUserId: "daniel-cooper", linkedClientName: "Anna Kowalski" },
  { weekOffset: 0, weekday: 0, startHour: 14, startMinute: 0, endHour: 15, endMinute: 30, titleKey: "documentReview", scope: "personal", ownerUserId: "emma-wilson", createdByUserId: "emma-wilson" },
  { weekOffset: 0, weekday: 0, startHour: 16, startMinute: 30, endHour: 17, endMinute: 30, titleKey: "internalVideoMeeting", scope: "company", eventType: "video_meeting", createdByUserId: "lucas-martin" },
  { weekOffset: 0, weekday: 1, startHour: 9, startMinute: 30, endHour: 10, endMinute: 30, titleKey: "crmReview", scope: "company", createdByUserId: "daniel-cooper" },
  { weekOffset: 0, weekday: 1, startHour: 12, startMinute: 0, endHour: 13, endMinute: 0, titleKey: "aiWorkflowPlanning", scope: "company", createdByUserId: "olivia-bennett", location: "Conference Room B" },
  { weekOffset: 0, weekday: 1, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, titleKey: "residencePermitSubmission", scope: "personal", ownerUserId: "daniel-cooper", createdByUserId: "daniel-cooper" },
  { weekOffset: 0, weekday: 2, startHour: 10, startMinute: 0, endHour: 11, endMinute: 0, titleKey: "partnerSync", scope: "company", eventType: "video_meeting", createdByUserId: "emma-wilson" },
  { weekOffset: 0, weekday: 2, startHour: 13, startMinute: 0, endHour: 14, endMinute: 0, titleKey: "caseStrategySession", scope: "personal", ownerUserId: "lucas-martin", createdByUserId: "lucas-martin" },
  { weekOffset: 0, weekday: 2, startHour: 16, startMinute: 0, endHour: 17, endMinute: 0, titleKey: "clientFollowUpCall", scope: "company", eventType: "video_meeting", createdByUserId: "daniel-cooper", linkedClientName: "Marco Rossi" },
  { weekOffset: 0, weekday: 3, startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, titleKey: "weeklyOperationsStandup", scope: "company", createdByUserId: "olivia-bennett" },
  { weekOffset: 0, weekday: 3, startHour: 11, startMinute: 30, endHour: 12, endMinute: 30, titleKey: "visaDocumentChecklist", scope: "personal", ownerUserId: "emma-wilson", createdByUserId: "emma-wilson" },
  { weekOffset: 0, weekday: 3, startHour: 14, startMinute: 30, endHour: 15, endMinute: 30, titleKey: "immigrationPolicyBriefing", scope: "company", createdByUserId: "lucas-martin", location: "Main office" },
  { weekOffset: 0, weekday: 4, startHour: 10, startMinute: 0, endHour: 11, endMinute: 30, titleKey: "clientOnboardingWorkshop", scope: "company", eventType: "video_meeting", createdByUserId: "daniel-cooper" },
  { weekOffset: 0, weekday: 4, startHour: 13, startMinute: 0, endHour: 14, endMinute: 0, titleKey: "personalPlanningBlock", scope: "personal", ownerUserId: "olivia-bennett", createdByUserId: "olivia-bennett" },
  { weekOffset: 0, weekday: 4, startHour: 15, startMinute: 0, endHour: 16, endMinute: 0, titleKey: "teamRetrospective", scope: "company", createdByUserId: "emma-wilson" },
  { weekOffset: 0, weekday: 5, startHour: 11, startMinute: 0, endHour: 12, endMinute: 0, titleKey: "demoEnvironmentReview", scope: "company", createdByUserId: "lucas-martin" },
  { weekOffset: 0, weekday: 6, startHour: 0, startMinute: 0, endHour: 23, endMinute: 59, titleKey: "companyOffsiteDay", scope: "company", allDay: true, createdByUserId: "olivia-bennett", location: "Spiora HQ" },
  { weekOffset: 1, weekday: 0, startHour: 9, startMinute: 0, endHour: 10, endMinute: 0, titleKey: "nextWeekKickoff", scope: "company", createdByUserId: "olivia-bennett" },
  { weekOffset: 1, weekday: 1, startHour: 10, startMinute: 30, endHour: 11, endMinute: 30, titleKey: "clientPortfolioReview", scope: "company", createdByUserId: "daniel-cooper" },
  { weekOffset: 1, weekday: 2, startHour: 14, startMinute: 0, endHour: 15, endMinute: 0, titleKey: "complianceDeadlinePrep", scope: "personal", ownerUserId: "emma-wilson", createdByUserId: "emma-wilson", sendReminders: true },
  { weekOffset: 1, weekday: 3, startHour: 11, startMinute: 0, endHour: 12, endMinute: 0, titleKey: "externalPartnerCall", scope: "company", eventType: "video_meeting", createdByUserId: "lucas-martin" },
  { weekOffset: 1, weekday: 4, startHour: 9, startMinute: 30, endHour: 10, endMinute: 30, titleKey: "quarterlyPlanning", scope: "company", createdByUserId: "olivia-bennett" },
  { weekOffset: 1, weekday: 4, startHour: 15, startMinute: 30, endHour: 16, endMinute: 30, titleKey: "privateFocusTime", scope: "personal", ownerUserId: "daniel-cooper", createdByUserId: "daniel-cooper", sendReminders: false },
  { weekOffset: 1, weekday: 5, startHour: 10, startMinute: 0, endHour: 11, endMinute: 0, titleKey: "knowledgeBaseReview", scope: "company", createdByUserId: "emma-wilson" },
  { weekOffset: 0, weekday: 1, startHour: 17, startMinute: 0, endHour: 18, endMinute: 0, titleKey: "upcomingMeetingPrep", scope: "personal", ownerUserId: "lucas-martin", createdByUserId: "lucas-martin" },
  { weekOffset: 0, weekday: 3, startHour: 17, startMinute: 30, endHour: 18, endMinute: 30, titleKey: "internalVideoMeeting", scope: "company", eventType: "video_meeting", createdByUserId: "olivia-bennett" },
];

export function buildDemoCalendarEvents(
  referenceDate = new Date(),
  timeZone: string = CALENDAR_TIMEZONE,
): CalendarEvent[] {
  const mondayKey = getMondayOfWeek(referenceDate, timeZone);
  const now = new Date().toISOString();

  return DEMO_TEMPLATES.map((template) => {
    const dateKey = addDays(
      addDays(mondayKey, template.weekOffset * 7, timeZone),
      template.weekday,
      timeZone,
    );
    const allDay = template.allDay ?? false;
    const eventType = template.eventType ?? CALENDAR_DEFAULT_EVENT_TYPE;
    const createdByName =
      DEMO_AUTHORS[template.createdByUserId] ?? "Demo User";
    const storedTitle = buildDemoEventTitle(template.titleKey);

    const startAt = allDay
      ? toIso(dateKey, 0, 0, timeZone)
      : toIso(dateKey, template.startHour, template.startMinute, timeZone);
    const endAt = allDay
      ? toIso(dateKey, 23, 59, timeZone)
      : toIso(dateKey, template.endHour, template.endMinute, timeZone);

    return {
      id: randomUUID(),
      companyId: CALENDAR_COMPANY_ID,
      scope: template.scope,
      ownerUserId:
        template.scope === "personal"
          ? (template.ownerUserId ?? template.createdByUserId)
          : null,
      title: storedTitle,
      description: template.description ?? "",
      eventType,
      videoInviteMode: eventType === "video_meeting" ? "all_team" : null,
      guestWaitingRoom: true,
      guestMaxCount: eventType === "video_meeting" ? 10 : null,
      guestAccessPasswordHash: null,
      guestAccessPasswordSet: false,
      linkedClientId: template.linkedClientName
        ? `demo-client-${template.titleKey}`
        : null,
      linkedClientName: template.linkedClientName ?? null,
      externalInvitees: [],
      participantUserIds: [],
      startAt,
      endAt,
      allDay,
      location: template.location ?? (eventType === "video_meeting" ? "Spiora Video Room" : ""),
      sendReminders: template.sendReminders ?? CALENDAR_DEFAULT_SEND_REMINDERS,
      createdByUserId: template.createdByUserId,
      createdByName,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export const DEMO_EVENT_TEMPLATE_COUNT = DEMO_TEMPLATES.length;
