"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./ClientQuestionnairePage.module.css";
import { buildReviewSections } from "@/lib/client-portal/questionnaire-review";
import { isQuestionVisible } from "@/lib/client-portal/questionnaire-visibility";
import {
  DISPLAY_ONLY_TYPES,
  type ValidationErrorItem,
  type ValidationReasonCode,
} from "@/lib/client-portal/questionnaire-types";
import { initialQuestionnaireSaveState } from "@/lib/client-portal/questionnaire-save-state";
import {
  countCompletedSections,
  computeLiveSectionProgress,
  getAdjacentSectionIds,
  getSectionNavState,
  listIncompleteRequiredFields,
  validateSectionRequiredFields,
} from "@/lib/client-portal/questionnaire-nav";
import {
  applyLocalAnswerOperation,
  type AnswerPatchOperation,
} from "@/lib/client-portal/questionnaire-answer-buffer";
import {
  buildSectionFocusHref,
  clearValidationSession,
  fieldLabelFromSchema,
  getNextValidationError,
  orderValidationErrors,
  readFocusQuestionIdFromSearch,
  readValidationSession,
  revalidateAnswersLocally,
  writeValidationSession,
} from "@/lib/client-portal/questionnaire-validation-ui";
import {
  getCountryOptions,
  resolveCountryToIso,
} from "@/lib/client-portal/questionnaire-countries";
import { resolveClientFirstName } from "@/lib/client-portal/display-name";

type SchemaSection = {
  id: string;
  order?: number;
  title: { en: string; ru: string };
  description?: { en: string; ru: string };
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
  authFirstName?: string | null;
  displayName?: string | null;
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

function asFileAnswer(
  value: unknown,
): { id: string; fileName: string; mimeType: string; sizeBytes: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.id !== "string" || !rec.id || typeof rec.fileName !== "string" || !rec.fileName) {
    return null;
  }
  return {
    id: rec.id,
    fileName: rec.fileName,
    mimeType: typeof rec.mimeType === "string" ? rec.mimeType : "",
    sizeBytes: typeof rec.sizeBytes === "number" ? rec.sizeBytes : 0,
  };
}

function formatFileSize(bytes: number, locale: "en" | "ru"): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} ${locale === "ru" ? "КБ" : "KB"}`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} ${locale === "ru" ? "МБ" : "MB"}`;
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
  const [errors, setErrors] = useState<ValidationErrorItem[]>([]);
  const [validationGateActive, setValidationGateActive] = useState(false);
  const [validationLiveMessage, setValidationLiveMessage] = useState("");
  const [showUpdatedBanner, setShowUpdatedBanner] = useState(false);
  const [uploadingById, setUploadingById] = useState<Record<string, boolean>>({});
  const [uploadErrorById, setUploadErrorById] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef<CurrentResponse | null>(null);
  const localAnswersRef = useRef<Record<string, unknown>>({});
  const dirtyQuestionIdsRef = useRef<Set<string>>(new Set());
  const saveInFlightRef = useRef(false);
  const saveAgainRef = useRef(false);
  const sectionTitleRef = useRef<HTMLHeadingElement | null>(null);
  const focusAppliedRef = useRef(false);
  const validationGateRef = useRef(false);

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

  useEffect(() => {
    validationGateRef.current = validationGateActive;
  }, [validationGateActive]);

  useEffect(() => {
    if (loading) return;
    const stored = readValidationSession();
    if (stored?.gateActive && stored.errors.length > 0) {
      setErrors(stored.errors);
      setValidationGateActive(true);
      setValidationLiveMessage(
        t("validation.announceErrors", { count: stored.errors.length }),
      );
    }

    if (focusAppliedRef.current) return;
    const focusId =
      readFocusQuestionIdFromSearch(window.location.search) ||
      stored?.focusQuestionId ||
      null;
    if (!focusId || reviewMode) return;
    focusAppliedRef.current = true;
    const timer = window.setTimeout(() => {
      focusFirstInvalid(focusId);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [loading, reviewMode, t]);

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

  const displayName = useMemo(
    () =>
      resolveClientFirstName({
        authFirstName: data?.authFirstName,
        questionnaireFirstName: localAnswers.first_name,
      }),
    [data?.authFirstName, localAnswers.first_name],
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

      const current = dataRef.current;
      if (validationGateRef.current && current?.template?.schema) {
        const nextErrors = revalidateAnswersLocally(
          current.template.schema as never,
          next,
          locale,
        );
        queueMicrotask(() => {
          setErrors(nextErrors);
          if (nextErrors.length === 0) {
            setValidationGateActive(false);
            setShowUpdatedBanner(true);
            setValidationLiveMessage(t("validation.questionnaireUpdated"));
            clearValidationSession();
          } else {
            writeValidationSession({
              errors: nextErrors,
              focusQuestionId: questionId,
              gateActive: true,
            });
            setValidationLiveMessage(
              t("validation.announceErrors", { count: nextErrors.length }),
            );
          }
        });
      }

      return next;
    });
  }

  async function onUploadFile(questionId: string, file: File) {
    setUploadErrorById((prev) => ({ ...prev, [questionId]: "" }));
    setUploadingById((prev) => ({ ...prev, [questionId]: true }));
    try {
      const body = new FormData();
      body.set("questionId", questionId);
      body.set("file", file);
      const res = await fetch("/api/client/questionnaire/attachments", {
        method: "POST",
        body,
      });
      const json = (await res.json().catch(() => null)) as {
        attachment?: {
          id: string;
          fileName: string;
          mimeType: string;
          sizeBytes: number;
        };
        error?: { code?: string; message?: string };
      } | null;
      if (!res.ok || !json?.attachment) {
        const code = json?.error?.code;
        const message =
          code === "FILE_TOO_LARGE"
            ? t("fileTooLarge")
            : code === "UNSUPPORTED_FILE_TYPE"
              ? t("fileUnsupported")
              : code === "QUESTIONNAIRE_READ_ONLY"
                ? t("fileReadOnly")
                : code === "UNAUTHORIZED"
                  ? t("fileAuthRequired")
                  : t("fileUploadError");
        setUploadErrorById((prev) => ({ ...prev, [questionId]: message }));
        return;
      }
      onAnswer(questionId, "file", {
        id: json.attachment.id,
        fileName: json.attachment.fileName,
        mimeType: json.attachment.mimeType,
        sizeBytes: json.attachment.sizeBytes,
      });
    } catch {
      setUploadErrorById((prev) => ({ ...prev, [questionId]: t("fileUploadError") }));
    } finally {
      setUploadingById((prev) => ({ ...prev, [questionId]: false }));
    }
  }

  async function onRemoveFile(questionId: string) {
    const current = asFileAnswer(localAnswersRef.current[questionId]);
    onAnswer(questionId, "file", null);
    setUploadErrorById((prev) => ({ ...prev, [questionId]: "" }));
    if (!current?.id) return;
    try {
      await fetch(`/api/client/questionnaire/attachments/${encodeURIComponent(current.id)}`, {
        method: "DELETE",
      });
    } catch {
      // Local clear already applied; orphan cleanup is best-effort.
    }
  }

  function focusFirstInvalid(questionId: string) {
    const el = document.getElementById(`question-${questionId}`);
    if (el instanceof HTMLElement) {
      el.focus();
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function reasonMessage(reason: ValidationReasonCode | undefined, fallback: string) {
    if (!reason) return fallback;
    try {
      return t(`validation.reasons.${reason}` as never);
    } catch {
      return fallback || t("validation.invalidOption");
    }
  }

  function errorFieldLabel(error: ValidationErrorItem): string {
    if (error.fieldLabel) return error.fieldLabel;
    if (!data) return error.questionId;
    return fieldLabelFromSchema(data.template.schema as never, error.questionId, locale);
  }

  function persistValidationGate(nextErrors: ValidationErrorItem[], focusQuestionId: string | null) {
    const ordered = data
      ? orderValidationErrors(data.template.schema as never, nextErrors)
      : nextErrors;
    setErrors(ordered);
    setValidationGateActive(ordered.length > 0);
    setShowUpdatedBanner(false);
    if (ordered.length === 0) {
      clearValidationSession();
      setValidationLiveMessage(t("validation.questionnaireUpdated"));
      return;
    }
    writeValidationSession({
      errors: ordered,
      focusQuestionId,
      gateActive: true,
    });
    setValidationLiveMessage(
      t("validation.announceErrors", { count: ordered.length }),
    );
  }

  function jumpToValidationError(error: ValidationErrorItem | null) {
    if (!error?.sectionId) return;
    writeValidationSession({
      errors,
      focusQuestionId: error.questionId,
      gateActive: true,
    });
    window.location.href = buildSectionFocusHref(error.sectionId, error.questionId);
  }

  function fixValidationErrors() {
    const first =
      data
        ? orderValidationErrors(data.template.schema as never, errors)[0]
        : errors[0];
    jumpToValidationError(first ?? null);
  }

  function goToNextValidationError() {
    if (!data) return;
    const currentFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.id.replace(/^question-/, "")
        : null;
    const next = getNextValidationError(
      data.template.schema as never,
      errors,
      currentFocus,
    );
    if (!next) return;
    if (next.sectionId === currentSectionId) {
      focusFirstInvalid(next.questionId);
      return;
    }
    jumpToValidationError(next);
  }

  function validateCurrentSection(): boolean {
    if (!currentSection) return true;
    const sectionErrors = validateSectionRequiredFields(
      currentSection,
      localAnswers,
      locale,
    ).map((error) => ({
      sectionId: error.sectionId,
      questionId: error.questionId,
      code: "REQUIRED",
      message: error.message,
      reason: "MISSING_REQUIRED" as const,
      fieldLabel: error.message.replace(/ is required$/i, "") || error.questionId,
    }));
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

  async function submitFinalQuestionnaire() {
    const saved = await flushPendingSave();
    if (!saved) return;
    const res = await fetch("/api/client/questionnaire/submit", { method: "POST" });
    if (res.ok) {
      clearValidationSession();
      window.location.href = "/client/questionnaire/submitted";
      return;
    }
    const json = (await res.json()) as {
      errors?: ValidationErrorItem[];
      invalidFields?: string[];
      invalidFieldDetails?: Array<{
        field: string;
        section: string;
        reason: ValidationReasonCode;
        label?: string;
      }>;
      error?: { code?: string; message?: string };
    };
    if (json.error?.code === "QUESTIONNAIRE_ALREADY_SUBMITTED") {
      clearValidationSession();
      window.location.href = "/client/questionnaire/submitted";
      return;
    }
    if (json.error?.code !== "QUESTIONNAIRE_VALIDATION_FAILED") {
      return;
    }

    const nextErrors =
      json.errors && json.errors.length > 0
        ? json.errors
        : (json.invalidFieldDetails ?? []).map((detail) => ({
            sectionId: detail.section,
            questionId: detail.field,
            code: "INVALID_OPTION",
            message: detail.label ?? detail.field,
            reason: detail.reason,
            fieldLabel: detail.label,
          }));

    const ordered = data
      ? orderValidationErrors(data.template.schema as never, nextErrors)
      : nextErrors;
    persistValidationGate(ordered, ordered[0]?.questionId ?? null);
  }

  async function returnToEditing() {
    const status = dataRef.current?.questionnaire.status;
    if (status === "in_review") {
      const res = await fetch("/api/client/questionnaire/reopen", { method: "POST" });
      if (!res.ok) return;
    }
    if (validationGateActive && errors.length > 0) {
      fixValidationErrors();
      return;
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

  const incompleteRequired = useMemo(() => {
    if (!data) return [];
    return listIncompleteRequiredFields(orderedSections, localAnswers, locale);
  }, [data, orderedSections, localAnswers, locale]);

  const reviewSections = useMemo(() => {
    if (!data || !reviewMode) return [];
    return buildReviewSections(
      data.template.schema as never,
      localAnswers,
      locale as "en" | "ru",
    );
  }, [data, reviewMode, localAnswers, locale]);

  const orderedValidationErrors = useMemo(() => {
    if (!data || errors.length === 0) return errors;
    return orderValidationErrors(data.template.schema as never, errors);
  }, [data, errors]);

  const countryOptions = useMemo(() => getCountryOptions(locale), [locale]);

  const isSubmitted =
    data?.questionnaire.status === "submitted" || data?.questionnaire.status === "locked";
  const canSubmitFromReview =
    !isSubmitted &&
    (data?.questionnaire.status === "draft" ||
      data?.questionnaire.status === "not_started" ||
      data?.questionnaire.status === "in_review") &&
    incompleteRequired.length === 0 &&
    !(validationGateActive && orderedValidationErrors.length > 0);

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
        <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {validationLiveMessage}
        </div>
        <header className={styles.header}>
          <h1>{data.template.schema.title[locale]}</h1>
          <p>{t(`status.${data.questionnaire.status}` as never)}</p>
          <p className={styles.saveState}>
            {saving === "error" && saveErrorCode
              ? t("save.errorWithCode", { code: saveErrorCode })
              : t(`save.${saving}` as never)}
          </p>
        </header>

        {showUpdatedBanner ? (
          <section className={styles.updatedBanner} role="status">
            <p>{t("validation.questionnaireUpdated")}</p>
          </section>
        ) : null}

        {orderedValidationErrors.length > 0 ? (
          <section className={styles.errorSummary} aria-labelledby="validation-summary-title">
            <h2 id="validation-summary-title">
              {validationGateActive
                ? t("validation.summaryTitle")
                : t("errorSummaryTitle")}
            </h2>
            {validationGateActive ? (
              <p className={styles.reviewIntro}>{t("validation.summaryIntro")}</p>
            ) : null}
            <p className={styles.validationListTitle}>{t("validation.updateRequiredTitle")}</p>
            <ul>
              {orderedValidationErrors.map((error) => (
                <li key={`${error.sectionId}:${error.questionId}`}>
                  <button
                    type="button"
                    onClick={() => jumpToValidationError(error)}
                  >
                    {errorFieldLabel(error)}
                  </button>
                </li>
              ))}
            </ul>
            <div className={styles.validationActions}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={fixValidationErrors}
              >
                {t("validation.fixErrors")}
              </button>
              {!reviewMode && orderedValidationErrors.length > 1 ? (
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={goToNextValidationError}
                >
                  {t("validation.nextError")}
                </button>
              ) : null}
            </div>
          </section>
        ) : null}

        {reviewMode ? (
          <section className={styles.review}>
            <header className={styles.reviewHeader}>
              <h2 className={styles.reviewTitle}>{t("reviewTitle")}</h2>
              <p className={styles.reviewIntro}>{t("reviewIntro")}</p>
            </header>
            {incompleteRequired.length > 0 ? (
              <section className={styles.errorSummary}>
                <h2>{t("incompleteRequiredTitle")}</h2>
                <p className={styles.reviewIntro}>{t("incompleteRequiredIntro")}</p>
                <ul>
                  {incompleteRequired.map((item) => (
                    <li key={`${item.sectionId}:${item.questionId}`}>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = buildSectionFocusHref(
                            item.sectionId,
                            item.questionId,
                          );
                        }}
                      >
                        {item.sectionTitle}: {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {validationGateActive && orderedValidationErrors.length > 0 ? (
              <section className={styles.reviewWarning} role="alert">
                <h2>{t("validation.reviewWarningTitle")}</h2>
                <p className={styles.reviewIntro}>{t("validation.reviewWarningIntro")}</p>
                <p className={styles.validationListTitle}>{t("validation.updateRequiredTitle")}</p>
                <ul>
                  {orderedValidationErrors.map((error) => (
                    <li key={`review-${error.sectionId}:${error.questionId}`}>
                      {errorFieldLabel(error)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={fixValidationErrors}
                >
                  {t("validation.fixErrors")}
                </button>
              </section>
            ) : null}
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
              {!isSubmitted ? (
                <button type="button" className={styles.secondaryBtn} onClick={() => void returnToEditing()}>
                  {t("reopen")}
                </button>
              ) : null}
              {isSubmitted ? (
                <a href="/client/questionnaire/submitted" className={styles.primaryBtn}>
                  {t("viewSubmission")}
                </a>
              ) : canSubmitFromReview ? (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={() => void submitFinalQuestionnaire()}
                >
                  {t("submitQuestionnaire")}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled
                  aria-disabled="true"
                >
                  {t("submitQuestionnaire")}
                </button>
              )}
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
              {currentSection.id === "welcome" && displayName
                ? t("welcomeNamed", { name: displayName })
                : currentSection.title[locale]}
            </h2>
            {currentSection.description ? (
              <p className={styles.displayDescription}>{currentSection.description[locale]}</p>
            ) : null}
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
              <div
                key={q.id}
                className={[
                  styles.field,
                  errors.some((err) => err.questionId === q.id) ? styles.fieldInvalid : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {q.type === "file" ? (
                  <span className={styles.fieldLabel}>
                    {q.label[locale]}{q.required ? " *" : ""}
                  </span>
                ) : (
                  <label htmlFor={`question-${q.id}`} className={styles.fieldLabel}>
                    {q.label[locale]}{q.required ? " *" : ""}
                  </label>
                )}
                {q.description && q.type !== "file" ? (
                  <p className={styles.displayDescription}>{q.description[locale]}</p>
                ) : null}
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
                ) : q.type === "country" ? (
                  <select
                    id={`question-${q.id}`}
                    value={resolveCountryToIso(localAnswers[q.id]) ?? ""}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    disabled={Boolean(q.readOnly)}
                    className={q.readOnly ? styles.readOnlyControl : undefined}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={
                      [
                        errors.some((err) => err.questionId === q.id) ? `error-${q.id}` : null,
                        `country-hint-${q.id}`,
                        q.readOnly ? `hint-${q.id}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  >
                    <option value="">{t("selectPlaceholder")}</option>
                    {countryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
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
                ) : q.type === "file" ? (
                  <div className={styles.fileField}>
                    {q.description ? (
                      <p className={styles.displayDescription}>{q.description[locale]}</p>
                    ) : null}
                    {(() => {
                      const fileAnswer = asFileAnswer(localAnswers[q.id]);
                      const uploading = Boolean(uploadingById[q.id]);
                      const uploadDisabled =
                        Boolean(q.readOnly) ||
                        uploading ||
                        data.questionnaire.status === "in_review" ||
                        data.questionnaire.status === "submitted" ||
                        data.questionnaire.status === "locked";
                      if (fileAnswer) {
                        return (
                          <div className={styles.fileAttached}>
                            <span className={styles.fileAttachedMark} aria-hidden>
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <path
                                  d="M8 4.75h5.2L18.25 9.8V19.25A1.75 1.75 0 0 1 16.5 21h-8.5A1.75 1.75 0 0 1 6.25 19.25v-12.5A1.75 1.75 0 0 1 8 4.75Z"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                />
                                <path
                                  d="M13.25 4.9V9.5H17.8"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M9 13.25h6M9 16.5h4.2"
                                  stroke="currentColor"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                />
                              </svg>
                            </span>
                            <div className={styles.fileAttachedBody}>
                              <a
                                className={styles.fileLink}
                                href={`/api/client/questionnaire/attachments/${encodeURIComponent(fileAnswer.id)}`}
                              >
                                {fileAnswer.fileName}
                              </a>
                              <span className={styles.fileMeta}>
                                {formatFileSize(fileAnswer.sizeBytes, locale)}
                                {formatFileSize(fileAnswer.sizeBytes, locale) ? " · " : ""}
                                {t("fileReady")}
                              </span>
                            </div>
                            {!q.readOnly &&
                            data.questionnaire.status !== "in_review" &&
                            data.questionnaire.status !== "submitted" &&
                            data.questionnaire.status !== "locked" ? (
                              <button
                                type="button"
                                className={styles.fileRemoveBtn}
                                onClick={() => void onRemoveFile(q.id)}
                              >
                                {t("fileRemove")}
                              </button>
                            ) : null}
                          </div>
                        );
                      }
                      return (
                        <label
                          className={[
                            styles.fileDropzone,
                            uploading ? styles.fileDropzoneBusy : "",
                            uploadDisabled ? styles.fileDropzoneDisabled : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onDragOver={(e) => {
                            if (uploadDisabled) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "copy";
                          }}
                          onDrop={(e) => {
                            if (uploadDisabled) return;
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (file) void onUploadFile(q.id, file);
                          }}
                        >
                          <input
                            id={`question-${q.id}`}
                            type="file"
                            className={styles.fileInputHidden}
                            disabled={uploadDisabled}
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx,application/pdf,image/*"
                            aria-invalid={errors.some((err) => err.questionId === q.id)}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) void onUploadFile(q.id, file);
                            }}
                          />
                          <span className={styles.fileDropMark} aria-hidden>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                              <path
                                d="M12 15.25V5.75"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                              <path
                                d="M8.75 9 12 5.75 15.25 9"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M5.75 14.5v3.75A1.75 1.75 0 0 0 7.5 20h9a1.75 1.75 0 0 0 1.75-1.75V14.5"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                              />
                            </svg>
                          </span>
                          <span className={styles.fileDropTitle}>
                            {uploading ? t("fileUploading") : t("fileDropTitle")}
                          </span>
                          {!uploading ? (
                            <span className={styles.fileDropAction}>{t("fileBrowse")}</span>
                          ) : null}
                          <span className={styles.fileHint}>{t("fileHint")}</span>
                        </label>
                      );
                    })()}
                    {uploadErrorById[q.id] ? (
                      <span className={styles.errorText}>{uploadErrorById[q.id]}</span>
                    ) : null}
                  </div>
                ) : q.type === "date" ? (
                  <input
                    id={`question-${q.id}`}
                    type={localAnswers[q.id] ? "date" : "text"}
                    placeholder={t("datePlaceholder")}
                    value={String(localAnswers[q.id] ?? "")}
                    onFocus={(e) => {
                      e.currentTarget.type = "date";
                    }}
                    onBlur={(e) => {
                      if (!e.currentTarget.value) {
                        e.currentTarget.type = "text";
                      }
                    }}
                    onChange={(e) => onAnswer(q.id, q.type, e.target.value)}
                    readOnly={Boolean(q.readOnly)}
                    className={q.readOnly ? styles.readOnlyControl : undefined}
                    aria-invalid={errors.some((err) => err.questionId === q.id)}
                    aria-describedby={
                      [
                        errors.some((err) => err.questionId === q.id)
                          ? `error-${q.id}`
                          : null,
                        q.readOnly ? `hint-${q.id}` : null,
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined
                    }
                  />
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
                      q.type === "number"
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
                {q.type === "country" ? (
                  <span id={`country-hint-${q.id}`} className={styles.displayDescription}>
                    {t("countryHint")}
                  </span>
                ) : null}
                {q.readOnly ? (
                  <span id={`hint-${q.id}`} className={styles.readOnlyHint}>
                    {t("readOnlyFromAccount")}
                  </span>
                ) : null}
                {errors.find((err) => err.questionId === q.id) ? (
                  <span id={`error-${q.id}`} className={styles.errorText} role="alert">
                    <span className={styles.errorIcon} aria-hidden="true">
                      !
                    </span>
                    {reasonMessage(
                      errors.find((err) => err.questionId === q.id)?.reason,
                      errors.find((err) => err.questionId === q.id)?.message ||
                        t("validation.invalidOption"),
                    )}
                  </span>
                ) : null}
              </div>
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
