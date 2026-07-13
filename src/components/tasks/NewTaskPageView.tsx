"use client";

import { branding } from "@/config/branding";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TaskForm, type TaskFormValues } from "@/components/tasks/TaskForm";
import { uploadTaskFiles } from "@/components/tasks/TaskAttachments";
import styles from "./NewTaskPage.module.css";

type NewTaskPageViewProps = {
  teamMembers: { id: string; name: string }[];
};

export function NewTaskPageView({ teamMembers }: NewTaskPageViewProps) {
  const router = useRouter();
  const t = useTranslations("tasks");

  async function handleCreate(values: TaskFormValues, files?: File[]) {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: values.title,
        description: values.description,
        dueDate: values.dueDate || null,
        status: values.status,
        assigneeIds: values.assigneeIds,
      }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? t("errors.saveFailed"));
    }

    const data = (await res.json()) as { task?: { id: string } };
    if (data.task?.id && files?.length) {
      await uploadTaskFiles(data.task.id, files);
    }

    router.push("/tasks?created=1");
  }

  return (
    <div className={styles.wrap}>
      <SectionHeader
        title={t("newTask")}
        subtitle={t("subtitle", { companyName: branding.companyName })}
      />
      <Card className={styles.card}>
        <TaskForm
          teamMembers={teamMembers}
          submitLabel={t("createTask")}
          onCancel={() => router.push("/tasks")}
          onSubmit={handleCreate}
        />
      </Card>
    </div>
  );
}
