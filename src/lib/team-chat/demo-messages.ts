import "server-only";

import { randomUUID } from "node:crypto";
import type { TeamChatMessage } from "./types";
import { DEMO_MESSAGE_PREFIX } from "./demo-message-text";

type DemoMessageTemplate = {
  key: string;
  userId: string;
  userName: string;
  userRole: TeamChatMessage["user_role"];
  minutesAgo: number;
  replyToIndex?: number;
  pinned?: boolean;
  pinnedByUserId?: string;
  messageType?: TeamChatMessage["message_type"];
  fileName?: string;
};

const DEMO_MESSAGE_TEMPLATES: DemoMessageTemplate[] = [
  { key: "mondayStandup", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 26 * 60 },
  { key: "pipelineMoved", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 24 * 60, pinned: true, pinnedByUserId: "olivia-bennett" },
  { key: "carterFileUpdate", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 22 * 60 },
  { key: "sofiaConsultationAsk", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 20 * 60 },
  { key: "martinsCoverageReply", userId: "lucas-martin", userName: "Lucas Martin", userRole: "manager", minutesAgo: 19 * 60, replyToIndex: 3 },
  { key: "sofiaDocumentStatus", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 17 * 60 },
  { key: "visaChecklistFile", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 15 * 60, messageType: "file", fileName: "visa-checklist-demo.pdf" },
  { key: "taskDeadlineReminder", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 13 * 60 },
  { key: "taskProgressUpdate", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 11 * 60 },
  { key: "meetingMovedThursday", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 9 * 60 },
  { key: "calendarLinkShare", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 8 * 60 },
  { key: "meetingPrepAnna", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 7 * 60 },
  { key: "aiSummaryReady", userId: "lucas-martin", userName: "Lucas Martin", userRole: "manager", minutesAgo: 6 * 60 },
  { key: "kbArticleLink", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 5 * 60 },
  { key: "clientPipelineReview", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 4 * 60 },
  { key: "overdueTasksNote", userId: "lucas-martin", userName: "Lucas Martin", userRole: "manager", minutesAgo: 3 * 60 },
  { key: "videoCallReminder", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 2 * 60 },
  { key: "aiWorkspaceLink", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 90 },
  { key: "internalTaskHandoff", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 80 },
  { key: "crmUpdateSofia", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 70 },
  { key: "documentReviewDone", userId: "lucas-martin", userName: "Lucas Martin", userRole: "manager", minutesAgo: 60 },
  { key: "teamFocusToday", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 50 },
  { key: "clientAnnaFiles", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 40 },
  { key: "calendarEventTomorrow", userId: "emma-wilson", userName: "Emma Wilson", userRole: "manager", minutesAgo: 30 },
  { key: "passportReminder", userId: "lucas-martin", userName: "Lucas Martin", userRole: "manager", minutesAgo: 20 },
  { key: "q3GoalsThread", userId: "olivia-bennett", userName: "Olivia Bennett", userRole: "owner", minutesAgo: 10 },
  { key: "closingThanks", userId: "daniel-cooper", userName: "Daniel Cooper", userRole: "manager", minutesAgo: 2 },
];

export const DEMO_TEAM_CHAT_MESSAGE_COUNT = DEMO_MESSAGE_TEMPLATES.length;

function demoText(key: string): string {
  return `${DEMO_MESSAGE_PREFIX}${key}`;
}

export function buildDemoTeamChatMessages(): TeamChatMessage[] {
  const now = Date.now();
  const built: TeamChatMessage[] = [];

  for (const template of DEMO_MESSAGE_TEMPLATES) {
    const createdAt = new Date(now - template.minutesAgo * 60 * 1000).toISOString();
    const id = randomUUID();
    const replySource =
      template.replyToIndex !== undefined ? built[template.replyToIndex] : null;

    built.push({
      id,
      user_id: template.userId,
      user_name: template.userName,
      user_role: template.userRole,
      message_type: template.messageType ?? "text",
      message_text: demoText(template.key),
      audio_url: null,
      audio_duration_ms: null,
      image_url: null,
      file_url: template.messageType === "file" ? `/api/team-chat/file/${id}` : null,
      file_name: template.fileName ?? null,
      file_content_type: template.messageType === "file" ? "application/pdf" : null,
      file_size: template.messageType === "file" ? 48_000 : null,
      reply_to_message_id: replySource?.id ?? null,
      reply_to_user_name: replySource?.user_name ?? null,
      reply_to_message_type: replySource?.message_type ?? null,
      reply_to_preview: replySource
        ? demoText(DEMO_MESSAGE_TEMPLATES[template.replyToIndex!].key)
        : null,
      is_pinned: Boolean(template.pinned),
      pinned_at: template.pinned ? createdAt : null,
      pinned_by_user_id: template.pinnedByUserId ?? null,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return built;
}
