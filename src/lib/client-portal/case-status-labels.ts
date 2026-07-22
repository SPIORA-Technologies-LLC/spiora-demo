import type { ClientCaseStatus } from "./case-types";
import type { ClientCaseActivityType } from "./case-types";

export const CASE_STATUS_LABELS: Record<
  ClientCaseStatus,
  { en: string; ru: string }
> = {
  application_received: {
    en: "Application received",
    ru: "Заявка получена",
  },
  initial_review: {
    en: "Initial specialist review",
    ru: "Первичная проверка",
  },
  documents_requested: {
    en: "Documents requested",
    ru: "Запрошены документы",
  },
  documents_under_review: {
    en: "Documents under review",
    ru: "Документы проверяются",
  },
  in_progress: {
    en: "In progress",
    ru: "В работе",
  },
  awaiting_decision: {
    en: "Awaiting decision",
    ru: "Ожидаем решение",
  },
  approved: {
    en: "Approved",
    ru: "Одобрено",
  },
  completed: {
    en: "Completed",
    ru: "Завершено",
  },
  cancelled: {
    en: "Cancelled",
    ru: "Отменено",
  },
};

export const CASE_ACTIVITY_LABELS: Record<
  ClientCaseActivityType,
  { en: string; ru: string }
> = {
  invitation_created: { en: "Invitation created", ru: "Приглашение создано" },
  invitation_accepted: { en: "Invitation accepted", ru: "Приглашение принято" },
  registration: { en: "Registration", ru: "Регистрация" },
  questionnaire_started: {
    en: "Questionnaire started",
    ru: "Анкета начата",
  },
  questionnaire_submitted: {
    en: "Questionnaire submitted",
    ru: "Анкета отправлена",
  },
  documents_uploaded: { en: "Documents uploaded", ru: "Документы загружены" },
  comment_added: { en: "Comment added", ru: "Добавлен комментарий" },
  status_changed: { en: "Status changed", ru: "Статус изменён" },
  employee_assigned: { en: "Specialist assigned", ru: "Назначен специалист" },
};

export function caseStatusLabel(
  status: ClientCaseStatus,
  locale: "en" | "ru",
): string {
  return CASE_STATUS_LABELS[status][locale];
}

export function caseActivityLabel(
  eventType: string,
  locale: "en" | "ru",
): string {
  const known = CASE_ACTIVITY_LABELS[eventType as ClientCaseActivityType];
  if (known) return known[locale];
  return eventType;
}
