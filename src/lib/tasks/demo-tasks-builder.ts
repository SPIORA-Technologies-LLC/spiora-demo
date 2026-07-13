import { randomUUID } from "node:crypto";
import { listTeamUsers } from "@/lib/auth/users";
import { DEMO_TASK_PREFIX } from "./demo-task-text";
import { DEMO_TASK_SEEDS } from "./demo-tasks";
import type { Task, TaskAssignee } from "./types";

const USER_NAMES: Record<string, string> = Object.fromEntries(
  listTeamUsers().map((user) => [user.id, user.name]),
);

function isoDateOffset(base: Date, days: number): string {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function isoDateTimeOffset(base: Date, days: number): string {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

export function buildDemoTasks(now = new Date()): Task[] {
  return DEMO_TASK_SEEDS.map((seed) => {
    const createdAt = isoDateTimeOffset(now, -14 + seed.dueOffsetDays % 5);
    const updatedAt = isoDateTimeOffset(now, -1);
    const dueDate = isoDateOffset(now, seed.dueOffsetDays);
    const completedAt =
      seed.status === "completed"
        ? isoDateTimeOffset(now, seed.completedOffsetDays ?? -1)
        : null;

    const assignees: TaskAssignee[] = seed.assigneeIds
      .map((id) => ({ id, name: USER_NAMES[id] ?? id }))
      .filter((item) => item.name);

    return {
      id: `demo-task-${seed.slug}`,
      title: `${DEMO_TASK_PREFIX}${seed.slug}.title`,
      description: `${DEMO_TASK_PREFIX}${seed.slug}.description`,
      status: seed.status,
      priority: seed.priority,
      createdByUserId: seed.createdById,
      createdByName: USER_NAMES[seed.createdById] ?? seed.createdById,
      assignees,
      createdAt,
      dueDate,
      completedAt,
      updatedAt,
      reviewHistory: [],
      attachments: [],
      progressReports: [],
    };
  });
}

export function resetDemoTaskIdsForTests(tasks: Task[]): Task[] {
  return tasks.map((task) => ({ ...task, id: randomUUID() }));
}
