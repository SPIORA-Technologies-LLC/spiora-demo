import { NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/config";
import { FinanceError, financeErrorStatus } from "@/lib/finance/errors";

const ERROR_MESSAGES: Record<string, { en: string; ru: string }> = {
  FINANCE_ACCESS_DENIED: {
    en: "You do not have access to Finance.",
    ru: "У вас нет доступа к разделу «Финансы».",
  },
  FINANCE_PROFILE_NOT_FOUND: {
    en: "Finance profile not found.",
    ru: "Финансовый профиль не найден.",
  },
  FINANCE_CLIENT_NOT_FOUND: {
    en: "Client not found.",
    ru: "Клиент не найден.",
  },
  FINANCE_CONTRACT_ALREADY_EXISTS: {
    en: "Contract is already set. Use the change flow.",
    ru: "Договор уже создан. Используйте изменение суммы.",
  },
  FINANCE_CONTRACT_AMOUNT_REQUIRED: {
    en: "Contract amount is required.",
    ru: "Укажите сумму договора.",
  },
  FINANCE_CONTRACT_NOT_SET: {
    en: "Contract amount must be set first.",
    ru: "Сначала укажите сумму договора.",
  },
  FINANCE_CHANGE_REASON_REQUIRED: {
    en: "Reason for change is required.",
    ru: "Укажите причину изменения.",
  },
  FINANCE_AMOUNT_UNCHANGED: {
    en: "New value must differ from the current one.",
    ru: "Новое значение должно отличаться от текущего.",
  },
  FINANCE_PAYMENT_AMOUNT_INVALID: {
    en: "Payment amount is invalid.",
    ru: "Некорректная сумма платежа.",
  },
  FINANCE_PAYMENT_DATE_INVALID: {
    en: "Payment date is invalid.",
    ru: "Некорректная дата платежа.",
  },
  FINANCE_PAYMENT_NOT_FOUND: {
    en: "Payment not found.",
    ru: "Платёж не найден.",
  },
  FINANCE_PAYMENT_ALREADY_VOIDED: {
    en: "Payment is already voided.",
    ru: "Платёж уже аннулирован.",
  },
  FINANCE_DIRECTION_INVALID: {
    en: "Invalid direction filter.",
    ru: "Некорректное направление.",
  },
  FINANCE_CONFLICT: {
    en: "Finance data was changed by another employee. Refresh and try again.",
    ru: "Финансовые данные были изменены другим сотрудником. Обновите страницу и повторите действие.",
  },
  FINANCE_CONCURRENT_MODIFICATION: {
    en: "Finance data was changed by another employee. Refresh and try again.",
    ru: "Финансовые данные были изменены другим сотрудником. Обновите страницу и повторите действие.",
  },
  FINANCE_COMMENT_TOO_LONG: {
    en: "Comment is too long.",
    ru: "Комментарий слишком длинный.",
  },
  FINANCE_IDEMPOTENCY_REQUIRED: {
    en: "Idempotency key is required.",
    ru: "Требуется ключ идемпотентности.",
  },
  FINANCE_STORE_UNAVAILABLE: {
    en: "Finance store is temporarily unavailable.",
    ru: "Финансовое хранилище временно недоступно.",
  },
};

export function financeErrorResponse(error: unknown, locale: AppLocale) {
  if (error instanceof FinanceError) {
    const localized =
      ERROR_MESSAGES[error.code]?.[locale] ??
      ERROR_MESSAGES[error.code]?.en ??
      error.message;
    return NextResponse.json(
      { error: localized, code: error.code },
      { status: financeErrorStatus(error.code) },
    );
  }
  console.error("[finance]", error);
  return NextResponse.json(
    {
      error:
        locale === "ru"
          ? "Не удалось выполнить финансовую операцию."
          : "Finance operation failed.",
      code: "FINANCE_INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
