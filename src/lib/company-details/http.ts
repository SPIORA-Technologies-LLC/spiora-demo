import { NextResponse } from "next/server";
import type { AppLocale } from "@/i18n/config";
import {
  CompanyDetailsError,
  companyDetailsErrorStatus,
} from "@/lib/company-details/errors";

const ERROR_MESSAGES: Record<string, { en: string; ru: string }> = {
  COMPANY_DETAILS_ACCESS_DENIED: {
    en: "You do not have access to Company Details.",
    ru: "У вас нет доступа к разделу «Реквизиты компании».",
  },
  COMPANY_DETAILS_NOT_FOUND: {
    en: "Company details not found.",
    ru: "Реквизиты компании не найдены.",
  },
  COMPANY_DETAILS_VALIDATION: {
    en: "Please check the entered company details.",
    ru: "Проверьте введённые реквизиты компании.",
  },
  COMPANY_DETAILS_VERSION_CONFLICT: {
    en: "Company details were changed by another user. Refresh the page and try again.",
    ru: "Реквизиты были изменены другим пользователем. Обновите страницу и повторите изменения.",
  },
  COMPANY_DETAILS_STORE_UNAVAILABLE: {
    en: "Company details store is temporarily unavailable.",
    ru: "Хранилище реквизитов временно недоступно.",
  },
};

export function companyDetailsErrorResponse(error: unknown, locale: AppLocale) {
  if (error instanceof CompanyDetailsError) {
    const localized =
      ERROR_MESSAGES[error.code]?.[locale] ??
      ERROR_MESSAGES[error.code]?.en ??
      error.message;
    return NextResponse.json(
      {
        error: localized,
        code: error.code,
        fieldErrors: error.fieldErrors,
      },
      { status: companyDetailsErrorStatus(error.code) },
    );
  }
  console.error("[company-details]", error);
  return NextResponse.json(
    {
      error:
        locale === "ru"
          ? "Не удалось выполнить операцию с реквизитами."
          : "Company details operation failed.",
      code: "COMPANY_DETAILS_INTERNAL_ERROR",
    },
    { status: 500 },
  );
}
