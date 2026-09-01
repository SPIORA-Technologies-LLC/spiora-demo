import type { Task } from "./types";
import { getActivityDayKey } from "@/lib/presence/daily-activity-logic";

export function isTaskOverdue(task: Task): boolean {
  if (
    task.status === "completed" ||
    task.status === "pending_approval" ||
    !task.dueDate
  ) {
    return false;
  }
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

/** Whether the task was overdue at end of the given Moscow calendar day (YYYY-MM-DD). */
export function isTaskOverdueOnDay(task: Task, dayKey: string): boolean {
  if (
    task.status === "pending_approval" ||
    !task.dueDate ||
    task.dueDate > dayKey
  ) {
    return false;
  }
  if (!task.completedAt) return true;
  return getActivityDayKey(new Date(task.completedAt)) > dayKey;
}
