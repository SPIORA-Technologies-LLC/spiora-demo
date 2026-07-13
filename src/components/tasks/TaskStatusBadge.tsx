"use client";

import { useTranslations } from "next-intl";
import styles from "./TaskStatusBadge.module.css";
import type { TaskStatus } from "@/lib/tasks/types";

const STATUS_ICONS: Partial<Record<TaskStatus, string>> = {
  completed: "✅",
  pending_approval: "👀",
  needs_revision: "🔄",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations("tasks");
  const icon = STATUS_ICONS[status];
  const label = t(`statuses.${status}`);
  const text = icon ? `${icon} ${label}` : label;

  return (
    <span className={[styles.badge, styles[status]].join(" ")}>
      {text}
    </span>
  );
}
