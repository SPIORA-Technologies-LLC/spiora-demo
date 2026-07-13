"use client";

import { useState } from "react";
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
import type { Task, TaskReviewEvent } from "@/lib/tasks/types";
import { getLatestRevisionComment } from "@/lib/tasks/workflow";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TaskAttachmentsSection } from "./TaskAttachments";
import { TaskProgressReportsSection } from "./TaskProgressReports";
import styles from "./TaskDetailModal.module.css";

type TaskDetailModalProps = {
  task: Task;
  user: SessionUser;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStartTask: (task: Task) => void;
  onComplete: (task: Task) => void;
  onSubmitForApproval: (task: Task) => void;
  onApprove: (task: Task) => void;
  onRequestRevision: (task: Task, comment: string) => void;
  onTaskUpdated?: (task: Task) => void;
  workflowLoading?: boolean;
};

function reviewActionLabel(
  t: ReturnType<typeof useTranslations<"tasks">>,
  action: TaskReviewEvent["action"],
): string {
  switch (action) {
    case "submitted":
      return t("workflow.submitted");
    case "approved":
      return t("workflow.approved");
    case "revision_requested":
      return t("workflow.revisionRequested");
  }
}

export function TaskDetailModal({
  task,
  user,
  onClose,
  onEdit,
  onDelete,
  onStartTask,
  onComplete,
  onSubmitForApproval,
  onApprove,
  onRequestRevision,
  onTaskUpdated,
  workflowLoading = false,
}: TaskDetailModalProps) {
  const t = useTranslations("tasks");
  const locale = useLocale() as AppLocale;
  const [revisionComment, setRevisionComment] = useState("");
  const [revisionError, setRevisionError] = useState("");

  const overdue = isTaskOverdue(task);
  const isCompleted = task.status === "completed";
  const isPendingApproval = task.status === "pending_approval";
  const isNeedsRevision = task.status === "needs_revision";
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

  function handleRequestRevision() {
    const trimmed = revisionComment.trim();
    if (!trimmed) {
      setRevisionError(t("review.revisionError"));
      return;
    }
    setRevisionError("");
    onRequestRevision(task, trimmed);
    setRevisionComment("");
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
      <div className={styles.backdrop} onClick={onClose} aria-hidden />
      <Card
        className={[
          styles.modal,
          isCompleted ? styles.modalCompleted : "",
          isPendingApproval ? styles.modalPending : "",
          isNeedsRevision ? styles.modalRevision : "",
          overdue ? styles.modalOverdue : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className={styles.header}>
          <div className={styles.headerMain}>
            {overdue ? <span className={styles.overdueTag}>{t("banners.overdue")}</span> : null}
            {isCompleted ? (
              <span className={styles.completedTag}>{t("banners.approved")}</span>
            ) : null}
            {isPendingApproval && createdByMe ? (
              <span className={styles.pendingTag}>{t("banners.awaitingDecision")}</span>
            ) : null}
            <h2
              id="task-detail-title"
              className={[styles.title, isCompleted ? styles.titleDone : ""].join(" ")}
            >
              {task.title}
            </h2>
            <TaskStatusBadge status={task.status} />
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t("modal.closeAria")}>
            ×
          </button>
        </header>

        {isCompleted && createdByMe && !assignedToMe ? (
          <p className={styles.completedNotice}>
            {t("review.completedNotice", { completedAt: completedAtSuffix })}
          </p>
        ) : null}

        {isPendingApproval && createdByMe ? (
          <p className={styles.pendingNotice}>{t("review.pendingNotice")}</p>
        ) : null}

        {isNeedsRevision && assignedToMe && latestRevision ? (
          <div className={styles.revisionBox}>
            <strong>{t("review.authorComment")}</strong>
            <p>{latestRevision}</p>
          </div>
        ) : null}

        {task.description ? (
          <p className={[styles.description, isCompleted ? styles.textMuted : ""].join(" ")}>
            {task.description}
          </p>
        ) : (
          <p className={styles.noDescription}>{t("empty.noDescription")}</p>
        )}

        <TaskAttachmentsSection
          task={task}
          user={user}
          onTaskUpdated={onTaskUpdated}
        />

        <TaskProgressReportsSection
          task={task}
          user={user}
          onTaskUpdated={onTaskUpdated}
        />

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
              <dd>{formatTaskDateTime(task.completedAt, locale)}</dd>
            </div>
          ) : null}
        </dl>

        {task.reviewHistory.length > 0 ? (
          <section className={styles.history}>
            <h3 className={styles.historyTitle}>{t("review.historyTitle")}</h3>
            <ol className={styles.historyList}>
              {[...task.reviewHistory].reverse().map((event) => (
                <li key={event.id} className={styles.historyItem}>
                  <div className={styles.historyHead}>
                    <span className={styles.historyAction}>
                      {reviewActionLabel(t, event.action)}
                    </span>
                    <time className={styles.historyTime}>
                      {formatTaskDateTime(event.createdAt, locale)}
                    </time>
                  </div>
                  <p className={styles.historyMeta}>
                    {event.actorName}
                    {event.comment ? ` · «${event.comment}»` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {canReview ? (
          <section className={styles.reviewPanel}>
            <h3 className={styles.reviewTitle}>{t("review.title")}</h3>
            <div className={styles.reviewActions}>
              <Button
                type="button"
                onClick={() => onApprove(task)}
                disabled={workflowLoading}
              >
                ✅ {t("review.approve")}
              </Button>
            </div>
            <label className={styles.revisionField}>
              <span>{t("review.revisionLabel")}</span>
              <textarea
                className={styles.revisionInput}
                rows={3}
                value={revisionComment}
                onChange={(e) => {
                  setRevisionComment(e.target.value);
                  if (revisionError) setRevisionError("");
                }}
                placeholder={t("review.revisionPlaceholder")}
              />
            </label>
            {revisionError ? (
              <p className={styles.revisionError}>{revisionError}</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={handleRequestRevision}
              disabled={workflowLoading}
            >
              🔄 {t("actions.requestRevision")}
            </Button>
          </section>
        ) : null}

        {!isCompleted && !isPendingApproval ? (
          <div className={styles.statusActions}>
            <span className={styles.statusActionsLabel}>{t("actions.assigneeActions")}</span>
            <div className={styles.statusButtons}>
              {canStart ? (
                <Button
                  type="button"
                  variant="ghost"
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
                  onClick={() => onComplete(task)}
                  disabled={workflowLoading}
                >
                  ✅ {t("actions.complete")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className={styles.actions}>
          {canEdit && !isPendingApproval ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onClose();
                onEdit(task);
              }}
            >
              ✏️ {t("actions.edit")}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onClose();
                onDelete(task);
              }}
            >
              🗑 {t("actions.delete")}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("actions.close")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
