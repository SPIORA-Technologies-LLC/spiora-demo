"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AppLocale } from "@/i18n/config";
import type { SessionUser } from "@/lib/auth/types";
import { formatAssigneeNames } from "@/lib/tasks/assignees";
import { formatTaskDate, formatTaskDateTime } from "@/lib/tasks/format";
import { isTaskOverdue } from "@/lib/tasks/overdue";
import {
  canDirectComplete,
  canDeleteTask,
  canEditTask,
  canReviewTask,
  canStartTask,
  canSubmitForApproval,
  isTaskAssignee,
  isTaskCreator,
} from "@/lib/tasks/permissions";
import type { Task } from "@/lib/tasks/types";
import { getLatestRevisionComment } from "@/lib/tasks/workflow";
import { TaskStatusBadge } from "./TaskStatusBadge";
import styles from "./TaskCard.module.css";

type TaskCardProps = {
  task: Task;
  user: SessionUser;
  highlighted?: boolean;
  workflowLoading?: boolean;
  onOpen: (task: Task) => void;
  onStartTask: (task: Task) => void;
  onComplete: (task: Task) => void;
  onSubmitForApproval: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskCard({
  task,
  user,
  highlighted = false,
  workflowLoading = false,
  onOpen,
  onStartTask,
  onComplete,
  onSubmitForApproval,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const t = useTranslations("tasks");
  const locale = useLocale() as AppLocale;
  const isCompleted = task.status === "completed";
  const isPendingApproval = task.status === "pending_approval";
  const isNeedsRevision = task.status === "needs_revision";
  const overdue = isTaskOverdue(task);
  const createdByMe = isTaskCreator(task, user);
  const assignedToMe = isTaskAssignee(task, user.id);
  const canEdit = canEditTask(task, user);
  const canDelete = canDeleteTask(task, user);
  const canStart = canStartTask(task, user);
  const canSubmit = canSubmitForApproval(task, user);
  const canCompleteDirect = canDirectComplete(task, user);
  const canReview = canReviewTask(task, user);
  const latestRevision = getLatestRevisionComment(task);

  const completedAtSuffix = task.completedAt
    ? ` · ${formatTaskDateTime(task.completedAt, locale)}`
    : "";

  return (
    <Card
      className={[
        styles.card,
        task.status === "new" ? styles.statusNew : "",
        task.status === "in_progress" ? styles.statusInProgress : "",
        isPendingApproval ? styles.statusPending : "",
        isNeedsRevision ? styles.statusRevision : "",
        isCompleted ? styles.completed : "",
        overdue ? styles.overdue : "",
        highlighted ? styles.highlighted : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {overdue ? <div className={styles.overdueBanner}>{t("banners.overdue")}</div> : null}
      {isPendingApproval && createdByMe ? (
        <div className={styles.pendingBanner}>{t("banners.onYourReview")}</div>
      ) : null}
      {isNeedsRevision && assignedToMe ? (
        <div className={styles.revisionBanner}>{t("banners.needsRevision")}</div>
      ) : null}
      {isCompleted ? (
        <div className={styles.completedBanner}>
          {createdByMe && !assignedToMe
            ? `${t("banners.approved")}${completedAtSuffix}`
            : `${t("banners.completed")}${completedAtSuffix}`}
        </div>
      ) : null}

      <div className={styles.header}>
        <button
          type="button"
          className={styles.titleButton}
          onClick={() => onOpen(task)}
        >
          <h3
            className={[styles.title, isCompleted ? styles.titleDone : ""].join(
              " ",
            )}
          >
            {task.title}
          </h3>
        </button>
        <div className={styles.headerBadges}>
          {task.priority ? (
            <span className={styles.priorityBadge}>
              {t(`priorities.${task.priority}`)}
            </span>
          ) : null}
          <TaskStatusBadge status={task.status} />
        </div>
      </div>

      {isNeedsRevision && latestRevision ? (
        <p className={styles.revisionPreview}>
          <strong>{t("meta.comment")}:</strong> {latestRevision}
        </p>
      ) : null}

      {task.description ? (
        <p
          className={[
            styles.description,
            isCompleted ? styles.textMuted : "",
          ].join(" ")}
        >
          {task.description}
        </p>
      ) : null}

      <dl className={styles.meta}>
        <div>
          <dt>{t("meta.author")}</dt>
          <dd>{task.createdByName}</dd>
        </div>
        <div>
          <dt>{t("meta.assignees")}</dt>
          <dd>{formatAssigneeNames(task.assignees, t("notAssigned"))}</dd>
        </div>
        <div>
          <dt>{t("meta.created")}</dt>
          <dd>{formatTaskDateTime(task.createdAt, locale)}</dd>
        </div>
        <div>
          <dt>{t("meta.due")}</dt>
          <dd className={overdue ? styles.dueOverdue : ""}>
            {formatTaskDate(task.dueDate, locale)}
          </dd>
        </div>
        {isCompleted && task.completedAt ? (
          <div>
            <dt>{t("meta.completed")}</dt>
            <dd className={styles.completedAt}>
              {formatTaskDateTime(task.completedAt, locale)}
            </dd>
          </div>
        ) : null}
      </dl>

      {!isCompleted && !isPendingApproval ? (
        <div className={styles.statusActions}>
          <span className={styles.statusActionsLabel}>{t("actions.quickActions")}</span>
          <div className={styles.statusButtons}>
            {canStart ? (
              <Button
                type="button"
                variant="ghost"
                className={styles.statusBtnInProgress}
                onClick={() => onStartTask(task)}
                disabled={workflowLoading}
              >
                ▶ {t("actions.start")}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button
                type="button"
                variant="ghost"
                className={styles.statusBtnComplete}
                onClick={() => onSubmitForApproval(task)}
                disabled={workflowLoading}
              >
                ✅ {t("actions.submitForApproval")}
              </Button>
            ) : null}
            {canCompleteDirect ? (
              <Button
                type="button"
                variant="ghost"
                className={styles.statusBtnComplete}
                onClick={() => onComplete(task)}
                disabled={workflowLoading}
              >
                ✅ {t("actions.complete")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canReview ? (
        <div className={styles.reviewHint}>{t("workflow.reviewHint")}</div>
      ) : null}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={() => onOpen(task)}>
          {t("actions.open")}
        </Button>
        {canEdit && !isPendingApproval ? (
          <Button type="button" variant="secondary" onClick={() => onEdit(task)}>
            ✏️ {t("actions.edit")}
          </Button>
        ) : null}
        {canDelete ? (
          <Button type="button" variant="danger" onClick={() => onDelete(task)}>
            🗑 {t("actions.delete")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
