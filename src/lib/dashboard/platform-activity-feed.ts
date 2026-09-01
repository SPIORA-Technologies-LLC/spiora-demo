import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import { CALENDAR_COMPANY_ID } from "@/lib/calendar/constants";
import { listClientInvitations } from "@/lib/client-portal/invitations";
import { listIntakeCases } from "@/lib/client-portal/case-service";
import { listAllClients } from "@/lib/clients/store";
import {
  isSameMoscowDay,
  moscowDayEndIso,
  moscowDayStartIso,
} from "@/lib/dashboard/activity-day";
import { clampActivityAnchor, getActivityDayKey } from "@/lib/presence/daily-activity-logic";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { listTasksForUser } from "@/lib/tasks/store";
import type { Task } from "@/lib/tasks/types";

export const PLATFORM_ACTIVITY_TYPES = [
  "task_completed",
  "task_created",
  "invite_accepted",
  "intake_submitted",
  "chat_message",
  "client_created",
  "document_uploaded",
  "calendar_event",
] as const;

export type PlatformActivityType = (typeof PLATFORM_ACTIVITY_TYPES)[number];

export type PlatformActivityEvent = {
  id: string;
  type: PlatformActivityType;
  at: string;
  actor: string | null;
  key: string;
  values?: Record<string, string | number>;
  href?: string;
};

export type PlatformActivityPage = {
  dayKey: string;
  items: PlatformActivityEvent[];
  total: number;
  nextCursor: string | null;
};

export type ListPlatformActivityOptions = {
  dayKey?: string;
  limit?: number;
  cursor?: string | null;
};

const DEFAULT_ACTIVITY_LIMIT = 20;
const MAX_ACTIVITY_LIMIT = 50;
const BRIEFING_ACTIVITY_PREVIEW = 8;

function taskActorName(task: Task): string {
  return (
    task.assignees[0]?.name ??
    task.createdByName ??
    task.assignees.map((a) => a.name).join(", ") ??
    "—"
  );
}

function compareActivityDesc(a: PlatformActivityEvent, b: PlatformActivityEvent): number {
  const byTime = b.at.localeCompare(a.at);
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

export function encodeActivityFeedCursor(at: string, id: string): string {
  return Buffer.from(`${at}\0${id}`, "utf8").toString("base64url");
}

export function parseActivityFeedCursor(
  value: string | null | undefined,
): { at: string; id: string } | null {
  if (!value?.trim()) return null;
  try {
    const decoded = Buffer.from(value.trim(), "base64url").toString("utf8");
    const separator = decoded.indexOf("\0");
    if (separator <= 0) return null;
    const at = decoded.slice(0, separator);
    const id = decoded.slice(separator + 1);
    if (!at || !id) return null;
    return { at, id };
  } catch {
    return null;
  }
}

export function paginatePlatformActivity(
  events: PlatformActivityEvent[],
  options?: { limit?: number; cursor?: string | null },
): PlatformActivityPage {
  const limit = Math.max(
    1,
    Math.min(MAX_ACTIVITY_LIMIT, options?.limit ?? DEFAULT_ACTIVITY_LIMIT),
  );
  const sorted = [...events].sort(compareActivityDesc);
  const parsedCursor = parseActivityFeedCursor(options?.cursor);
  const filtered = parsedCursor
    ? sorted.filter((item) => {
        if (item.at < parsedCursor.at) return true;
        if (item.at > parsedCursor.at) return false;
        return item.id < parsedCursor.id;
      })
    : sorted;

  const items = filtered.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    items.length === limit && filtered.length > limit && last
      ? encodeActivityFeedCursor(last.at, last.id)
      : null;

  return {
    dayKey: "",
    items,
    total: sorted.length,
    nextCursor,
  };
}

async function listCalendarEventsForDay(dayKey: string) {
  if (!isSupabaseConfigured()) return [];
  try {
    const { sbListEventsInRange } = await import(
      "@/lib/supabase/calendar-events-repo"
    );
    return sbListEventsInRange(
      CALENDAR_COMPANY_ID,
      moscowDayStartIso(dayKey),
      moscowDayEndIso(dayKey),
    );
  } catch {
    return [];
  }
}

async function listDocumentsUploadedOnDay(dayKey: string): Promise<
  Array<{
    id: string;
    clientId: string;
    fileName: string;
    uploadedByName: string;
    uploadedAt: string;
  }>
> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { getSupabaseAdmin } = await import("@/lib/supabase/server");
    const { data, error } = await getSupabaseAdmin()
      .from("client_documents")
      .select("id, client_id, original_file_name, uploaded_by_name, uploaded_at")
      .is("archived_at", null)
      .gte("uploaded_at", moscowDayStartIso(dayKey))
      .lt("uploaded_at", moscowDayEndIso(dayKey))
      .order("uploaded_at", { ascending: false });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      id: String(row.id),
      clientId: String(row.client_id),
      fileName: String(row.original_file_name ?? "document"),
      uploadedByName: String(row.uploaded_by_name ?? "—"),
      uploadedAt: String(row.uploaded_at),
    }));
  } catch {
    return [];
  }
}

async function listChatMessagesForDay(dayKey: string): Promise<
  Array<{ id: string; userName: string; createdAt: string }>
> {
  try {
    if (isSupabaseConfigured()) {
      const { sbListAllTeamChatMessages } = await import(
        "@/lib/supabase/team-chat-repo"
      );
      const messages = await sbListAllTeamChatMessages();
      return messages
        .filter((message) => isSameMoscowDay(message.created_at, dayKey))
        .map((message) => ({
          id: message.id,
          userName: message.user_name,
          createdAt: message.created_at,
        }));
    }

    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.join(process.cwd(), ".data", "team-chat-messages.json");
    const raw = await readFile(filePath, "utf8");
    const store = JSON.parse(raw) as {
      messages?: Array<{ id: string; user_name: string; created_at: string }>;
    };
    return (store.messages ?? [])
      .filter((message) => isSameMoscowDay(message.created_at, dayKey))
      .map((message) => ({
        id: message.id,
        userName: message.user_name,
        createdAt: message.created_at,
      }));
  } catch {
    return [];
  }
}

function pushTaskEvents(
  items: PlatformActivityEvent[],
  tasks: Task[],
  dayKey: string,
): void {
  for (const task of tasks) {
    if (isSameMoscowDay(task.completedAt, dayKey)) {
      items.push({
        id: `task-completed-${task.id}`,
        type: "task_completed",
        at: task.completedAt ?? task.updatedAt,
        actor: taskActorName(task),
        key: "daily.activity.taskCompleted",
        values: { name: taskActorName(task), title: task.title },
        href: "/tasks",
      });
    }
    if (isSameMoscowDay(task.createdAt, dayKey)) {
      items.push({
        id: `task-created-${task.id}`,
        type: "task_created",
        at: task.createdAt,
        actor: task.createdByName,
        key: "daily.activity.taskCreated",
        values: { name: task.createdByName, title: task.title },
        href: "/tasks",
      });
    }
  }
}

export async function collectPlatformActivityEvents(
  user: SessionUser,
  dayKey: string,
): Promise<PlatformActivityEvent[]> {
  const [
    tasks,
    invitations,
    intakePage,
    clientsResult,
    calendarEvents,
    documents,
    chatMessages,
  ] = await Promise.all([
    listTasksForUser(user),
    listClientInvitations(),
    listIntakeCases({ page: 1, pageSize: 200 }),
    listAllClients(),
    listCalendarEventsForDay(dayKey),
    listDocumentsUploadedOnDay(dayKey),
    listChatMessagesForDay(dayKey),
  ]);

  const items: PlatformActivityEvent[] = [];

  pushTaskEvents(items, tasks, dayKey);

  for (const invite of invitations) {
    if (!isSameMoscowDay(invite.acceptedAt, dayKey)) continue;
    items.push({
      id: `invite-${invite.id}`,
      type: "invite_accepted",
      at: invite.acceptedAt ?? "",
      actor: invite.email,
      key: "daily.activity.inviteAccepted",
      values: { email: invite.email },
      href: "/client-invitations",
    });
  }

  for (const intake of intakePage.items) {
    if (!isSameMoscowDay(intake.submittedAt, dayKey)) continue;
    const name = `${intake.firstName} ${intake.lastName}`.trim() || "—";
    items.push({
      id: `intake-${intake.id}`,
      type: "intake_submitted",
      at: intake.submittedAt ?? "",
      actor: name,
      key: "daily.activity.caseSubmitted",
      values: { name },
      href: `/clients/intake/${intake.id}`,
    });
  }

  for (const client of clientsResult.items) {
    const createdIso = client.createdAt ?? client.submittedAt;
    if (!isSameMoscowDay(createdIso, dayKey)) continue;
    items.push({
      id: `client-${client.id}`,
      type: "client_created",
      at: createdIso ?? "",
      actor: client.manager !== "—" ? client.manager : null,
      key: "daily.activity.clientCreated",
      values: { name: client.name },
      href: `/clients/${client.id}`,
    });
  }

  for (const document of documents) {
    items.push({
      id: `document-${document.id}`,
      type: "document_uploaded",
      at: document.uploadedAt,
      actor: document.uploadedByName,
      key: "daily.activity.documentUploaded",
      values: {
        name: document.uploadedByName,
        fileName: document.fileName,
      },
      href: `/clients/${document.clientId}`,
    });
  }

  for (const event of calendarEvents) {
    if (!isSameMoscowDay(event.startAt, dayKey)) continue;
    items.push({
      id: `calendar-${event.id}`,
      type: "calendar_event",
      at: event.startAt,
      actor: event.createdByName,
      key: "daily.activity.calendarEvent",
      values: { name: event.createdByName, title: event.title },
      href: "/calendar",
    });
  }

  for (const message of chatMessages) {
    items.push({
      id: `chat-${message.id}`,
      type: "chat_message",
      at: message.createdAt,
      actor: message.userName,
      key: "daily.activity.chatMessage",
      values: { name: message.userName },
      href: "/team-chat",
    });
  }

  return items.sort(compareActivityDesc);
}

export async function listPlatformActivityForDay(
  user: SessionUser,
  options?: ListPlatformActivityOptions,
): Promise<PlatformActivityPage> {
  const dayKey = clampActivityAnchor(options?.dayKey ?? getActivityDayKey());
  const events = await collectPlatformActivityEvents(user, dayKey);
  const page = paginatePlatformActivity(events, {
    limit: options?.limit,
    cursor: options?.cursor,
  });
  return { ...page, dayKey };
}

export async function listPlatformActivityPreview(
  user: SessionUser,
  dayKey: string,
  limit = BRIEFING_ACTIVITY_PREVIEW,
): Promise<PlatformActivityEvent[]> {
  const events = await collectPlatformActivityEvents(user, dayKey);
  return paginatePlatformActivity(events, { limit }).items;
}

export function countChatMessagesOnDay(
  events: PlatformActivityEvent[],
  dayKey: string,
): number {
  return events.filter(
    (event) => event.type === "chat_message" && isSameMoscowDay(event.at, dayKey),
  ).length;
}
