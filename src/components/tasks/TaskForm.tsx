"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDateSelect } from "@/components/calendar/CalendarDateSelect";
import { Button } from "@/components/ui/Button";
import type { Task, TaskStatus } from "@/lib/tasks/types";
import { TaskAttachmentPicker } from "./TaskAttachments";
import styles from "./TaskForm.module.css";

export type TaskFormValues = {
  title: string;
  description: string;
  dueDate: string;
  status: TaskStatus;
  assigneeIds: string[];
};

type TeamMemberOption = { id: string; name: string };

type TaskFormProps = {
  initial?: Partial<TaskFormValues>;
  teamMembers: TeamMemberOption[];
  submitLabel: string;
  isEditing?: boolean;
  onSubmit: (values: TaskFormValues, files?: File[]) => Promise<void>;
  onCancel: () => void;
};

const DEFAULT: TaskFormValues = {
  title: "",
  description: "",
  dueDate: "",
  status: "new",
  assigneeIds: [],
};

export function TaskForm({
  initial,
  teamMembers,
  submitLabel,
  isEditing = false,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const t = useTranslations("tasks");
  const [values, setValues] = useState<TaskFormValues>({
    ...DEFAULT,
    ...initial,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const statusOptions = useMemo(
    () =>
      (["new", "in_progress"] as const).map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      })),
    [t],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError(t("validation.titleRequired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(values, pendingFiles.length ? pendingFiles : undefined);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("errors.saveFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <label className={styles.field}>
        <span className={styles.label}>{t("form.titleLabel")}</span>
        <input
          className={styles.input}
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          placeholder={t("form.titlePlaceholder")}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>{t("form.descriptionLabel")}</span>
        <textarea
          className={styles.textarea}
          value={values.description}
          onChange={(e) =>
            setValues({ ...values, description: e.target.value })
          }
          rows={4}
          placeholder={t("form.descriptionPlaceholder")}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.label}>{t("form.dueDateLabel")}</span>
        <CalendarDateSelect
          value={values.dueDate}
          onChange={(dueDate) => setValues({ ...values, dueDate })}
          allowEmpty
        />
      </div>

      <TaskAttachmentPicker
        files={pendingFiles}
        onChange={setPendingFiles}
        disabled={loading}
      />

      <fieldset className={styles.field}>
        <legend className={styles.label}>{t("form.assigneesLabel")}</legend>
        <p className={styles.hint}>{t("form.assigneesHint")}</p>
        <div className={styles.assigneeList}>
          {teamMembers.map((member) => {
            const checked = values.assigneeIds.includes(member.id);
            return (
              <label key={member.id} className={styles.assigneeItem}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setValues((prev) => ({
                      ...prev,
                      assigneeIds: e.target.checked
                        ? [...prev.assigneeIds, member.id]
                        : prev.assigneeIds.filter((id) => id !== member.id),
                    }));
                  }}
                />
                <span>{member.name}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!isEditing ? (
        <label className={styles.field}>
          <span className={styles.label}>{t("form.statusLabel")}</span>
          <select
            className={styles.select}
            value={values.status}
            onChange={(e) =>
              setValues({ ...values, status: e.target.value as TaskStatus })
            }
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className={styles.hint}>{t("form.statusEditHint")}</p>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? t("form.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function taskToFormValues(task: Task): TaskFormValues {
  return {
    title: task.title,
    description: task.description,
    dueDate: task.dueDate ?? "",
    status:
      task.status === "new" || task.status === "in_progress"
        ? task.status
        : "in_progress",
    assigneeIds: task.assignees.map((assignee) => assignee.id),
  };
}
