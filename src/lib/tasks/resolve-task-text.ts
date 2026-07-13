import type { AppLocale } from "@/i18n/config";
import {
  translateTasksMessage,
  translateTasksPriority,
  translateTasksStatus,
} from "@/i18n/tasks-messages";
import type { Task, TaskPriority, TaskStatus } from "./types";
import { isDemoTaskText, resolveDemoTaskText } from "./demo-task-text";

export function resolveTaskTitle(locale: AppLocale, title: string): string {
  return resolveDemoTaskText(locale, title);
}

export function resolveTaskDescription(
  locale: AppLocale,
  description: string,
): string {
  return resolveDemoTaskText(locale, description);
}

export function localizeTask(locale: AppLocale, task: Task): Task {
  return {
    ...task,
    title: resolveTaskTitle(locale, task.title),
    description: resolveTaskDescription(locale, task.description),
    priority: task.priority ?? "medium",
  };
}

export function localizeTasks(locale: AppLocale, tasks: Task[]): Task[] {
  return tasks.map((task) => localizeTask(locale, task));
}

export function formatTaskStatusLabel(
  locale: AppLocale,
  status: TaskStatus,
): string {
  return translateTasksStatus(locale, status);
}

export function formatTaskPriorityLabel(
  locale: AppLocale,
  priority: TaskPriority,
): string {
  return translateTasksPriority(locale, priority);
}

export function taskMatchesSearch(
  task: Task,
  query: string,
  locale: AppLocale,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    resolveTaskTitle(locale, task.title),
    resolveTaskDescription(locale, task.description),
    task.createdByName,
    ...task.assignees.map((a) => a.name),
    formatTaskStatusLabel(locale, task.status),
    task.priority ? formatTaskPriorityLabel(locale, task.priority) : "",
  ]
    .join(" ")
    .toLowerCase();
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

export { isDemoTaskText };
