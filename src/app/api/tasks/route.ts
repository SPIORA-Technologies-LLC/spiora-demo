import { NextResponse } from "next/server";
import { getRequestLocale } from "@/i18n/api-messages";
import { translateTasksMessage } from "@/i18n/tasks-messages";
import { getSession } from "@/lib/auth/session";
import { isDemoModeActive } from "@/lib/demo/debug-guard";
import { notifyTaskCreated } from "@/lib/notifications/emit";
import {
  createTask,
  getTaskStats,
  listTasksForUser,
} from "@/lib/tasks/store";
import { localizeTask } from "@/lib/tasks/resolve-task-text";
import type { CreateTaskInput } from "@/lib/tasks/types";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("stats") === "1") {
    const stats = await getTaskStats(session);
    return NextResponse.json({ stats, demo: isDemoModeActive() });
  }

  const tasks = await listTasksForUser(session);
  return NextResponse.json({
    tasks: tasks.map((task) => localizeTask(locale, task)),
    demo: isDemoModeActive(),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locale = await getRequestLocale();
  const body = (await request.json()) as CreateTaskInput;
  if (!body.title?.trim()) {
    return NextResponse.json(
      { error: translateTasksMessage(locale, "validation.titleRequired") },
      { status: 400 },
    );
  }

  try {
    const task = await createTask(body, session);
    await notifyTaskCreated({
      actorId: session.id,
      actorName: session.name,
      taskTitle: task.title,
      assigneeIds: task.assignees.map((assignee) => assignee.id),
    });
    return NextResponse.json({ task: localizeTask(locale, task) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create task";
    if (message.includes("assignees")) {
      return NextResponse.json(
        { error: translateTasksMessage(locale, "errors.supabaseAssignees") },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: translateTasksMessage(locale, "errors.saveFailed") },
      { status: 500 },
    );
  }
}
