import type { AppLocale } from "@/i18n/config";
import { translateTasksMessage } from "@/i18n/tasks-messages";

export const DEMO_TASK_PREFIX = "demo:";

export function isDemoTaskText(text: string): boolean {
  return text.startsWith(DEMO_TASK_PREFIX);
}

export function resolveDemoTaskText(
  locale: AppLocale,
  text: string,
): string {
  if (!isDemoTaskText(text)) {
    return text;
  }
  const key = text.slice(DEMO_TASK_PREFIX.length);
  return translateTasksMessage(locale, `demoTasks.${key}`);
}
