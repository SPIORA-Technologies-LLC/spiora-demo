"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./ClientQuestionnairePage.module.css";
import { buildReviewSections } from "@/lib/client-portal/questionnaire-review";
import { isQuestionVisible } from "@/lib/client-portal/questionnaire-visibility";

type CurrentResponse = {
  questionnaire: {
    id: string | null;
    status: string;
    revision: number | null;
    answers: Record<string, unknown>;
    startedAt: string | null;
    lastSavedAt: string | null;
    reviewedAt: string | null;
  };
  template: {
    id: string;
    version: number;
    schema: {
      title: { en: string; ru: string };
      sections: Array<{
        id: string;
        title: { en: string; ru: string };
        questions: Array<{
          id: string;
          type: string;
          required?: boolean;
          readOnly?: boolean;
          derivedFrom?: string;
          label: { en: string; ru: string };
          description?: { en: string; ru: string };
          options?: Array<{ value: string; label: { en: string; ru: string } }>;
          visibleWhen?: { questionId: string; operator: string; value?: unknown };
        }>;
      }>;
    };
    schemaHash: string;
  };
  progress: {
    percent: number;
    sectionProgress: Record<string, { completed: number; total: number; percent: number }>;
  };
};

type Props = {
  initialSectionId?: string | null;
  reviewMode?: boolean;
};

export function ClientQuestionnairePage({ initialSectionId, reviewMode }: Props) {
  const t = useTranslations("clientPortal.questionnaire");
  const locale = useLocale() as "en" | "ru";
  const [data, setData] = useState<CurrentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Array<{ sectionId: string; questionId: string; message: string }>>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/client/questionnaire", { cache: "no-store" });
    const json = (await res.json()) as CurrentResponse;
    setData(json);
    setLocalAnswers(json.questionnaire.answers ?? {});
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const currentSectionId =
    reviewMode
      ? null
      : initialSectionId || data?.template.schema.sections[0]?.id || null;

  const currentSection = useMemo(
    () => data?.template.schema.sections.find((s) => s.id === currentSectionId) ?? null,
    [data, currentSectionId],
  );

  async function flushSave(operations: Array<{ op: "set" | "clear"; questionId: string; value?: unknown }>, nextLocal?: Record<string, unknown>) {
    if (!data) return;
    setSaving("saving");
    const res = await fetch("/api/client/questionnaire", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseRevision: data.questionnaire.revision,
        operations,
      }),
    });
    if (res.status === 409) {
      setSaving("conflict");
      return;
    }
    if (!res.ok) {
      setSaving("error");
      return;
    }
    const json = (await res.json()) as {
      revision: number;
      answers: Record<string, unknown>;
      lastSavedAt: string;
    };
    setData({
      ...data,
      questionnaire: {
        ...data.questionnaire,
        id: data.questionnaire.id ?? "created",
        revision: json.revision,
        answers: json.answers,
        lastSavedAt: json.lastSavedAt,
        status: data.questionnaire.status === "not_started" ? "draft" : data.questionnaire.status,
      },
    });
    if (nextLocal) {
      setLocalAnswers(nextLocal);
    }
    setSaving("saved");
  }

  function scheduleSave(
    operations: Array<{ op: "set" | "clear"; questionId: string; value?: unknown }>,
    nextLocal: Record<string, unknown>,
  ) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSave(operations, nextLocal);
    }, 700);
  }

  function opForValue(
    questionType: string,
    questionId: string,
    rawValue: unknown,
  ): { op: "set" | "clear"; questionId: string; value?: unknown } {
    if (questionType === "boolean") {
      return { op: "set", questionId, value: Boolean(rawValue) };
    }
    if (Array.isArray(rawValue) && rawValue.length === 0) {
      return { op: "clear", questionId };
    }
    if (rawValue === "" || rawValue === null || rawValue === undefined) {
      return { op: "clear", questionId };
    }
    return { op: "set", questionId, value: rawValue };
  }

  function onAnswer(questionId: string, questionType: string, value: unknown) {
    const operation = opForValue(questionType, questionId, value);
    const next =
      operation.op === "clear"
        ? Object.fromEntries(Object.entries(localAnswers).filter(([k]) => k !== questionId))
        : { ...localAnswers, [questionId]: operation.value };
    setLocalAnswers(next);
    scheduleSave([operation], next);
  }

  function focusFirstInvalid(questionId: string) {
    const el = document.getElementById(`question-${questionId}`);
    if (el instanceof HTMLElement) el.focus();
  }

  async function moveToReview() {
    const res = await fetch("/api/client/questionnaire/review", { method: "POST" });
    if (res.ok) {
      window.location.href = "/client/questionnaire/review";
      return;
    }
    const json = (await res.json()) as {
      errors?: Array<{ sectionId: string; questionId: string; message: string }>;
    };
    const nextErrors = json.errors ?? [];
    setErrors(nextErrors);
    const first = nextErrors[0];
    if (first?.sectionId) {
      window.location.href = `/client/questionnaire/${first.sectionId}`;
      setTimeout(() => focusFirstInvalid(first.questionId), 0);
    }
  }

  async function reopen() {
    const res = await fetch("/api/client/questionnaire/reopen", { method: "POST" });
    if (res.ok) {
      await load();
    }
  }

  if (loading || !data) {
    return <div className={styles.page}><p>{t("loading")}</p></div>;
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <h2>{t("sidebarTitle")}</h2>
        <p>{t("progress", { percent: data.progress.percent })}</p>
        <ul className={styles.sectionList}>
          {data.template.schema.sections.map((section) => (
            <li key={section.id}>
              <a href={`/client/questionnaire/${section.id}`}>{section.title[locale]}</a>
            </li>
          ))}
        </ul>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>{data.template.schema.title[locale]}</h1>
          <p>{t(`status.${data.questionnaire.status}` as never)}</p>
          <p className={styles.saveState}>{t(`save.${saving}` as never)}</p>
        </header>

        {errors.length > 0 ? (
          <section className={styles.errorSummary}>
            <h2>{t("errorSummaryTitle")}</h2>
            <ul>
              {errors.map((error) => (
                <li key={`${error.sectionId}:${error.questionId}`}>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = `/client/questionnaire/${error.sectionId}`;
                      setTimeout(() => focusFirstInvalid(error.questionId), 0);
                    }}
                  >
                    {error.message}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {reviewMode ? (
          <section className={styles.review}>
            {buildReviewSections(data.template.schema as never, localAnswers, locale as "en" | "ru").map((section) => (
              <article key={section.id} className={styles.card}>
                <h2>{section.title}</h2>
                {section.items.map((item) => (
                  <div key={item.questionId} className={styles.answerRow}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                ))}
              </article>
            ))}
            <button type="button" onClick={() => void reopen()}>{t("reopen")}</button>
          </section>
        ) : currentSection ? (
          <section className={styles.card}>
            <h2>{currentSection.title[locale]}</h2>
            {currentSection.questions
              .filter((q) => !q.visibleWhen || isQuestionVisible(q as never, localAnswers))
              .map((q) => (
              <label key={q.id} className={styles.field}>
                <span>{q.label[locale]}{q.required ? " *" : ""}</span>
                {q.type === "textarea" ? (
                  <textarea
                    id={`question-${q.id}`}
                    value={String(localAnswers[q.id] ?? "")}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    disabled={Boolean(q.readOnly)}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : undefined}
                  />
                ) : q.type === "select" ? (
                  <select
                    id={`question-${q.id}`}
                    value={String(localAnswers[q.id] ?? "")}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    disabled={Boolean(q.readOnly)}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : undefined}
                  >
                    <option value="">{t("selectPlaceholder")}</option>
                    {q.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label[locale]}
                      </option>
                    ))}
                  </select>
                ) : q.type === "boolean" ? (
                  <input
                    id={`question-${q.id}`}
                    type="checkbox"
                    checked={Boolean(localAnswers[q.id])}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.checked)}
                    disabled={Boolean(q.readOnly)}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : undefined}
                  />
                ) : (
                  <input
                    id={`question-${q.id}`}
                    type={q.type === "date" ? "date" : q.type === "number" ? "number" : "text"}
                    value={String(localAnswers[q.id] ?? "")}
                    onChange={(e) =>
                      onAnswer(
                        q.id,
                        q.type,
                        q.type === "number"
                          ? (e.target.value === "" ? "" : Number(e.target.value))
                          : e.target.value,
                      )
                    }
                    disabled={Boolean(q.readOnly)}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : undefined}
                  />
                )}
                {errors.find((err) => err.questionId === q.id) ? (
                  <span id={`error-${q.id}`} className={styles.errorText}>
                    {errors.find((err) => err.questionId === q.id)?.message}
                  </span>
                ) : null}
              </label>
            ))}
            <div className={styles.actions}>
              <a href="/client">{t("backHome")}</a>
              <button type="button" onClick={() => void moveToReview()}>{t("review")}</button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
