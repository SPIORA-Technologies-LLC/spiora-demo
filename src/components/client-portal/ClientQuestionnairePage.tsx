"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./ClientQuestionnairePage.module.css";
import { buildReviewSections } from "@/lib/client-portal/questionnaire-review";
import { isQuestionVisible } from "@/lib/client-portal/questionnaire-visibility";
import { DISPLAY_ONLY_TYPES } from "@/lib/client-portal/questionnaire-types";
import { initialQuestionnaireSaveState } from "@/lib/client-portal/questionnaire-save-state";
import {
  countCompletedSections,
  computeLiveSectionProgress,
  getAdjacentSectionIds,
  getSectionNavState,
  validateSectionRequiredFields,
} from "@/lib/client-portal/questionnaire-nav";
import {
  applyLocalAnswerOperation,
  type AnswerPatchOperation,
} from "@/lib/client-portal/questionnaire-answer-buffer";

type SchemaSection = {
  id: string;
  order?: number;
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
};

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
      sections: SchemaSection[];
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

function sectionNavMarker(state: "current" | "completed" | "incomplete"): string {
  if (state === "current") return "●";
  if (state === "completed") return "✓";
  return "○";
}

function currencyOptionSymbol(value: string): string {
  switch (value) {
    case "EUR":
      return "€";
    case "USD":
      return "$";
    case "RUB":
      return "₽";
    case "KZT":
      return "₸";
    default:
      return "•";
  }
}

export function ClientQuestionnairePage({ initialSectionId, reviewMode }: Props) {
  const t = useTranslations("clientPortal.questionnaire");
  const locale = useLocale() as "en" | "ru";
  const [data, setData] = useState<CurrentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("idle");
  const [saveErrorCode, setSaveErrorCode] = useState<string | null>(null);
  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Array<{ sectionId: string; questionId: string; message: string }>>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<CurrentResponse | null>(null);
  const localAnswersRef = useRef<Record<string, unknown>>({});
  const dirtyQuestionIdsRef = useRef<Set<string>>(new Set());
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const sectionTitleRef = useRef<HTMLHeadingElement | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const res = await fetch("/api/client/questionnaire", { cache: "no-store" });
    const json = (await res.json()) as CurrentResponse & {
      error?: { code?: string; message?: string };
    };
    if (!res.ok) {
      setData(null);
      dataRef.current = null;
      setLoadError(json.error?.code ?? `HTTP_${res.status}`);
      setSaving("idle");
      setLoading(false);
      return;
    }
    if (!json.template?.schema?.sections) {
      setData(null);
      dataRef.current = null;
      setLoadError("QUESTIONNAIRE_SCHEMA_INVALID");
      setSaving("idle");
      setLoading(false);
      return;
    }
    setData(json);
    dataRef.current = json;
    const answers = json.questionnaire.answers ?? {};
    localAnswersRef.current = answers;
    dirtyQuestionIdsRef.current.clear();
    setLocalAnswers(answers);
    setSaving(initialQuestionnaireSaveState(json.questionnaire));
    setSaveErrorCode(null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const orderedSections = useMemo(() => {
    if (!data) return [] as SchemaSection[];
    return [...data.template.schema.sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
  }, [data]);

  const orderedSectionIds = useMemo(
    () => orderedSections.map((section) => section.id),
    [orderedSections],
  );

  const currentSectionId =
    reviewMode
      ? null
      : initialSectionId || orderedSections[0]?.id || null;

  const currentSection = useMemo(
    () => orderedSections.find((s) => s.id === currentSectionId) ?? null,
    [orderedSections, currentSectionId],
  );

  const adjacent = useMemo(
    () => getAdjacentSectionIds(orderedSectionIds, currentSectionId),
    [orderedSectionIds, currentSectionId],
  );

  const liveProgress = useMemo(() => {
    if (!data) return null;
    return computeLiveSectionProgress(orderedSections, localAnswers);
  }, [data, orderedSections, localAnswers]);

  const completedSections = useMemo(() => {
    if (!liveProgress) return 0;
    return countCompletedSections(orderedSectionIds, liveProgress.sectionProgress);
  }, [liveProgress, orderedSectionIds]);

  useEffect(() => {
    if (reviewMode || !currentSection || loading) return;
    const title = sectionTitleRef.current;
    if (title) {
      title.focus();
    }
  }, [currentSectionId, reviewMode, loading, currentSection]);

  async function flushSave(): Promise<"ok" | "empty" | "busy" | "error" | "conflict"> {
    const current = dataRef.current;
    if (!current) return "empty";

    if (saveInFlightRef.current) {
      saveAgainRef.current = true;
      return "busy";
    }

    const dirtyIds = [...dirtyQuestionIdsRef.current];
    if (dirtyIds.length === 0) {
      setSaveErrorCode(null);
      return "empty";
    }

    const snapshot = localAnswersRef.current;
    const operations: Array<{ op: "set" | "clear"; questionId: string; value?: unknown }> = [];
    for (const questionId of dirtyIds) {
      const question = current.template.schema.sections
        .flatMap((section) => section.questions)
        .find((item) => item.id === questionId);
      if (!question || DISPLAY_ONLY_TYPES.has(question.type as never)) continue;
      if (question.readOnly || question.derivedFrom) continue;
      if (!(questionId in snapshot) || snapshot[questionId] === "" || snapshot[questionId] === null || snapshot[questionId] === undefined) {
        operations.push({ op: "clear", questionId });
      } else {
        operations.push({ op: "set", questionId, value: snapshot[questionId] });
      }
    }

    if (operations.length === 0) {
      dirtyQuestionIdsRef.current.clear();
      setSaveErrorCode(null);
      return "empty";
    }

    // Clear dirty set for the fields we're sending; re-dirty if user edits during flight.
    for (const op of operations) {
      dirtyQuestionIdsRef.current.delete(op.questionId);
    }

    saveInFlightRef.current = true;
    setSaving("saving");
    setSaveErrorCode(null);
    try {
      const res = await fetch("/api/client/questionnaire", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRevision: current.questionnaire.revision,
          operations,
        }),
      });
      if (res.status === 409) {
        for (const op of operations) {
          dirtyQuestionIdsRef.current.add(op.questionId);
        }
        setSaving("conflict");
        return "conflict";
      }
      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as {
          error?: { code?: string };
        } | null;
        // Re-queue failed fields so a later edit/save can retry.
        for (const op of operations) {
          dirtyQuestionIdsRef.current.add(op.questionId);
        }
        setSaveErrorCode(errJson?.error?.code ?? `HTTP_${res.status}`);
        setSaving("error");
        return "error";
      }
      const json = (await res.json()) as {
        revision: number;
        answers: Record<string, unknown>;
        lastSavedAt: string;
      };
      // Keep typing buffer intact — never clobber localAnswers with a save snapshot.
      const nextData: CurrentResponse = {
        ...current,
        questionnaire: {
          ...current.questionnaire,
          id: current.questionnaire.id ?? "created",
          revision: json.revision,
          answers: {
            ...json.answers,
            ...localAnswersRef.current,
          },
          lastSavedAt: json.lastSavedAt,
          status: current.questionnaire.status === "not_started" ? "draft" : current.questionnaire.status,
        },
      };
      dataRef.current = nextData;
      setData(nextData);
      setSaving("saved");
      return "ok";
    } finally {
      saveInFlightRef.current = false;
      if (saveAgainRef.current || dirtyQuestionIdsRef.current.size > 0) {
        saveAgainRef.current = false;
        scheduleSave();
      }
    }
  }

  async function flushPendingSave(): Promise<boolean> {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (saveInFlightRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 60));
        continue;
      }
      if (dirtyQuestionIdsRef.current.size === 0) return true;
      const result = await flushSave();
      if (result === "error" || result === "conflict") return false;
      if (result === "busy") {
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    }
    return dirtyQuestionIdsRef.current.size === 0;
  }

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushSave();
    }, 700);
  }

  function opForValue(
    questionType: string,
    questionId: string,
    rawValue: unknown,
  ): AnswerPatchOperation {
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
    if (DISPLAY_ONLY_TYPES.has(questionType as never)) return;
    const operation = opForValue(questionType, questionId, value);
    setLocalAnswers((prev) => {
      const next = applyLocalAnswerOperation(prev, operation);
      localAnswersRef.current = next;
      dirtyQuestionIdsRef.current.add(questionId);
      scheduleSave();
      return next;
    });
  }

  function focusFirstInvalid(questionId: string) {
    const el = document.getElementById(`question-${questionId}`);
    if (el instanceof HTMLElement) el.focus();
  }

  function validateCurrentSection(): boolean {
    if (!currentSection) return true;
    const sectionErrors = validateSectionRequiredFields(
      currentSection,
      localAnswers,
      locale,
    );
    setErrors(sectionErrors);
    if (sectionErrors.length > 0) {
      const first = sectionErrors[0];
      if (first) setTimeout(() => focusFirstInvalid(first.questionId), 0);
      return false;
    }
    return true;
  }

  function goToSection(sectionId: string) {
    window.location.href = `/client/questionnaire/${sectionId}`;
  }

  function onBack() {
    if (adjacent.previousId) {
      goToSection(adjacent.previousId);
      return;
    }
    window.location.href = "/client";
  }

  async function onPrimaryAction() {
    if (!adjacent.isLast && adjacent.nextId) {
      if (!validateCurrentSection()) return;
      goToSection(adjacent.nextId);
      return;
    }
    if (!validateCurrentSection()) return;
    const saved = await flushPendingSave();
    if (!saved) return;
    window.location.href = "/client/questionnaire/review";
  }

  async function moveToReview() {
    const saved = await flushPendingSave();
    if (!saved) return;
    const res = await fetch("/api/client/questionnaire/review", { method: "POST" });
    if (res.ok) {
      await load();
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

  async function returnToEditing() {
    const status = dataRef.current?.questionnaire.status;
    if (status === "in_review") {
      const res = await fetch("/api/client/questionnaire/reopen", { method: "POST" });
      if (!res.ok) return;
    }
    const fallbackId = orderedSections[orderedSections.length - 1]?.id;
    const targetId =
      orderedSections.find((section) => {
        const progress = liveProgress?.sectionProgress[section.id];
        return progress && progress.completed < progress.total;
      })?.id ?? fallbackId;
    if (targetId) {
      window.location.href = `/client/questionnaire/${targetId}`;
      return;
    }
    window.location.href = "/client/questionnaire";
  }

  const reviewSections = useMemo(() => {
    if (!data || !reviewMode) return [];
    return buildReviewSections(
      data.template.schema as never,
      localAnswers,
      locale as "en" | "ru",
    );
  }, [data, reviewMode, localAnswers, locale]);

  const canSubmitFromReview =
    data?.questionnaire.status === "draft" || data?.questionnaire.status === "not_started";

  if (loading) {
    return <div className={styles.page}><p>{t("loading")}</p></div>;
  }

  if (loadError || !data) {
    return (
      <div className={styles.page}>
        <p>{t("loadError", { code: loadError ?? "UNKNOWN" })}</p>
        <p>
          <a href="/client">{t("backHome")}</a>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <h2>{t("sidebarTitle")}</h2>
        <p>{t("progress", { percent: liveProgress?.percent ?? data.progress.percent })}</p>
        <p className={styles.sectionsCompleted}>
          {t("sectionsCompleted", {
            completed: completedSections,
            total: orderedSections.length,
          })}
        </p>
        <ul className={styles.sectionList}>
          {orderedSections.map((section) => {
            const navState = getSectionNavState(
              section.id,
              currentSectionId,
              liveProgress?.sectionProgress ?? data.progress.sectionProgress,
            );
            const marker = sectionNavMarker(navState);
            const stateLabel =
              navState === "current"
                ? t("navCurrent")
                : navState === "completed"
                  ? t("navCompleted")
                  : t("navIncomplete");
            return (
              <li key={section.id}>
                <a
                  href={`/client/questionnaire/${section.id}`}
                  className={
                    navState === "current"
                      ? styles.navLinkCurrent
                      : navState === "completed"
                        ? styles.navLinkCompleted
                        : styles.navLinkIncomplete
                  }
                  aria-current={navState === "current" ? "page" : undefined}
                  aria-label={`${stateLabel}: ${section.title[locale]}`}
                >
                  <span className={styles.navMarker} aria-hidden="true">
                    {marker}
                  </span>
                  <span>{section.title[locale]}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>{data.template.schema.title[locale]}</h1>
          <p>{t(`status.${data.questionnaire.status}` as never)}</p>
          <p className={styles.saveState}>
            {saving === "error" && saveErrorCode
              ? t("save.errorWithCode", { code: saveErrorCode })
              : t(`save.${saving}` as never)}
          </p>
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
            <header className={styles.reviewHeader}>
              <h2 className={styles.reviewTitle}>{t("reviewTitle")}</h2>
              <p className={styles.reviewIntro}>{t("reviewIntro")}</p>
            </header>
            {reviewSections.map((section) => (
              <article key={section.id} className={`${styles.card} ${styles.reviewSection}`}>
                <h3 className={styles.reviewSectionTitle}>{section.title}</h3>
                <dl className={styles.reviewList}>
                  {section.items.map((item) => (
                    <div key={item.questionId} className={styles.answerRow}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => void returnToEditing()}>
                {t("reopen")}
              </button>
              {canSubmitFromReview ? (
                <button type="button" className={styles.primaryBtn} onClick={() => void moveToReview()}>
                  {t("submitQuestionnaire")}
                </button>
              ) : null}
            </div>
          </section>
        ) : currentSection ? (
          <section className={styles.card}>
            <h2
              ref={sectionTitleRef}
              id={`section-title-${currentSection.id}`}
              className={styles.sectionTitle}
              tabIndex={-1}
            >
              {currentSection.title[locale]}
            </h2>
            {currentSection.questions
              .filter((q) => !q.visibleWhen || isQuestionVisible(q as never, localAnswers))
              .map((q) =>
              DISPLAY_ONLY_TYPES.has(q.type as never) ? (
                <div
                  key={q.id}
                  className={q.type === "heading" ? styles.displayHeading : styles.displayInfo}
                >
                  {q.type === "heading" ? (
                    <h3>{q.label[locale]}</h3>
                  ) : (
                    <p>{q.label[locale]}</p>
                  )}
                  {q.description ? (
                    <p className={styles.displayDescription}>{q.description[locale]}</p>
                  ) : null}
                </div>
              ) : (
              <label key={q.id} className={styles.field}>
                <span>{q.label[locale]}{q.required ? " *" : ""}</span>
                {q.type === "textarea" ? (
                  <textarea
                    id={`question-${q.id}`}
                    value={String(localAnswers[q.id] ?? "")}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    readOnly={Boolean(q.readOnly)}
                    className={q.readOnly ? styles.readOnlyControl : undefined}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={
                      [
                        errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : null,
                        q.readOnly ? `hint-${q.id}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                ) : q.type === "select" && q.id === "income_currency" ? (
                  <div
                    id={`question-${q.id}`}
                    className={styles.currencyChoices}
                    role="radiogroup"
                    aria-label={q.label[locale]}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : undefined}
                  >
                    {q.options?.map((option) => {
                      const selected = String(localAnswers[q.id] ?? "") === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={Boolean(q.readOnly)}
                          className={`${styles.currencyChoice}${selected ? ` ${styles.currencyChoiceSelected}` : ""}`}
                          onClick={() => onAnswer(q.id, q.type, option.value)}
                        >
                          <span className={styles.currencySymbol} aria-hidden>
                            {currencyOptionSymbol(option.value)}
                          </span>
                          <span className={styles.currencyLabel}>{option.label[locale]}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : q.type === "select" ? (
                  <select
                    id={`question-${q.id}`}
                    value={String(localAnswers[q.id] ?? "")}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    disabled={Boolean(q.readOnly)}
                    className={q.readOnly ? styles.readOnlyControl : undefined}
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
                    type={
                      q.type === "date"
                        ? "date"
                        : q.type === "number"
                          ? "number"
                          : q.type === "email"
                            ? "email"
                            : "text"
                    }
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
                    readOnly={Boolean(q.readOnly)}
                    className={q.readOnly ? styles.readOnlyControl : undefined}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={
                      [
                        errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : null,
                        q.readOnly ? `hint-${q.id}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
                )}
                {q.readOnly ? (
                  <span id={`hint-${q.id}`} className={styles.readOnlyHint}>
                    {t("readOnlyFromAccount")}
                  </span>
                ) : null}
                {errors.find((err) => err.questionId === q.id) ? (
                  <span id={`error-${q.id}`} className={styles.errorText}>
                    {errors.find((err) => err.questionId === q.id)?.message}
                  </span>
                ) : null}
              </label>
              ))}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={onBack}>
                {t("back")}
              </button>
              <button type="button" className={styles.primaryBtn} onClick={() => void onPrimaryAction()}>
                {adjacent.isLast ? t("reviewQuestionnaire") : t("next")}
              </button>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
