/**
 * Pure helpers for questionnaire section navigation UX (PR #31.1).
 * Client-safe: no Node crypto / schema-hash imports.
 */

import type { QuestionType } from "./questionnaire-types";
import { DISPLAY_ONLY_TYPES } from "./questionnaire-types";
import { isEmptyAnswer } from "./questionnaire-empty-values";
import { isQuestionVisible } from "./questionnaire-visibility";

export type SectionProgressMap = Record<
  string,
  { completed: number; total: number; percent: number }
>;

export type SectionNavState = "current" | "completed" | "incomplete";

type NavQuestion = {
  id: string;
  type: string;
  required?: boolean;
  readOnly?: boolean;
  derivedFrom?: string;
  label?: { en: string; ru: string };
  visibleWhen?: { questionId: string; operator: string; value?: unknown };
};

type NavSection = {
  id: string;
  questions: NavQuestion[];
};

export function isSectionComplete(
  sectionProgress: SectionProgressMap,
  sectionId: string,
): boolean {
  const sp = sectionProgress[sectionId];
  if (!sp) return false;
  return sp.total === 0 || sp.completed >= sp.total;
}

export function getSectionNavState(
  sectionId: string,
  currentSectionId: string | null,
  sectionProgress: SectionProgressMap,
): SectionNavState {
  if (currentSectionId && sectionId === currentSectionId) return "current";
  if (isSectionComplete(sectionProgress, sectionId)) return "completed";
  return "incomplete";
}

export function countCompletedSections(
  sectionIds: string[],
  sectionProgress: SectionProgressMap,
): number {
  return sectionIds.filter((id) => isSectionComplete(sectionProgress, id)).length;
}

export function getAdjacentSectionIds(
  orderedSectionIds: string[],
  currentSectionId: string | null,
): { previousId: string | null; nextId: string | null; isLast: boolean; isFirst: boolean } {
  if (!currentSectionId || orderedSectionIds.length === 0) {
    return { previousId: null, nextId: null, isLast: false, isFirst: true };
  }
  const index = orderedSectionIds.indexOf(currentSectionId);
  if (index < 0) {
    return { previousId: null, nextId: null, isLast: false, isFirst: true };
  }
  return {
    previousId: index > 0 ? orderedSectionIds[index - 1]! : null,
    nextId: index < orderedSectionIds.length - 1 ? orderedSectionIds[index + 1]! : null,
    isLast: index === orderedSectionIds.length - 1,
    isFirst: index === 0,
  };
}

/** Live section progress from answers — mirrors required-field rules without schema-hash. */
export function computeLiveSectionProgress(
  sections: NavSection[],
  answers: Record<string, unknown>,
): { percent: number; sectionProgress: SectionProgressMap } {
  let completedRequired = 0;
  let totalRequired = 0;
  const sectionProgress: SectionProgressMap = {};

  for (const section of sections) {
    let secCompleted = 0;
    let secTotal = 0;
    for (const q of section.questions) {
      if (DISPLAY_ONLY_TYPES.has(q.type as QuestionType)) continue;
      if (q.readOnly || q.derivedFrom) continue;
      if (!isQuestionVisible(q as never, answers)) continue;
      if (!q.required) continue;
      secTotal++;
      totalRequired++;
      if (!isEmptyAnswer(answers[q.id])) {
        secCompleted++;
        completedRequired++;
      }
    }
    sectionProgress[section.id] = {
      completed: secCompleted,
      total: secTotal,
      percent: secTotal > 0 ? Math.round((secCompleted / secTotal) * 100) : 100,
    };
  }

  return {
    percent:
      totalRequired > 0
        ? Math.round((completedRequired / totalRequired) * 100)
        : 0,
    sectionProgress,
  };
}

export type IncompleteRequiredField = {
  sectionId: string;
  questionId: string;
  sectionTitle: string;
  label: string;
};

/** User-editable required fields that are still empty (excludes derived/read-only). */
export function listIncompleteRequiredFields(
  sections: Array<NavSection & { title?: { en: string; ru: string } }>,
  answers: Record<string, unknown>,
  locale: "en" | "ru",
): IncompleteRequiredField[] {
  const incomplete: IncompleteRequiredField[] = [];
  for (const section of sections) {
    for (const q of section.questions) {
      if (DISPLAY_ONLY_TYPES.has(q.type as QuestionType)) continue;
      if (q.readOnly || q.derivedFrom) continue;
      if (!isQuestionVisible(q as never, answers)) continue;
      if (!q.required) continue;
      if (!isEmptyAnswer(answers[q.id])) continue;
      incomplete.push({
        sectionId: section.id,
        questionId: q.id,
        sectionTitle: section.title?.[locale] || section.title?.en || section.id,
        label: q.label?.[locale] || q.label?.en || q.id,
      });
    }
  }
  return incomplete;
}

export type SectionValidationError = {
  sectionId: string;
  questionId: string;
  message: string;
};

/** Required-field check for one section (client-safe, no schema-hash). */
export function validateSectionRequiredFields(
  section: NavSection,
  answers: Record<string, unknown>,
  locale: "en" | "ru",
): SectionValidationError[] {
  const errors: SectionValidationError[] = [];
  for (const q of section.questions) {
    if (DISPLAY_ONLY_TYPES.has(q.type as QuestionType)) continue;
    if (!isQuestionVisible(q as never, answers)) continue;
    if (q.readOnly || q.derivedFrom) continue;
    if (!q.required) continue;
    if (!isEmptyAnswer(answers[q.id])) continue;
    const label = q.label?.[locale] || q.label?.en || q.id;
    errors.push({
      sectionId: section.id,
      questionId: q.id,
      message: `${label} is required`,
    });
  }
  return errors;
}
