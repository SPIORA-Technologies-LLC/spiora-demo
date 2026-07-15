import { cookies } from "next/headers";
import type { AppLocale } from "./config";
import { LOCALE_COOKIE_NAME, parseLocale } from "./config";
import { translateMessage } from "./messages";

export type ApiMessageKey =
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "textRequired"
  | "noteSaveFailed"
  | "loadClientsFailed"
  | "loadClientFailed"
  | "createClientFailed"
  | "updateClientFailed"
  | "archiveClientFailed"
  | "validationFailed"
  | "crmStorageUnavailable";

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return parseLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

export function translateApiMessage(
  locale: AppLocale,
  key: ApiMessageKey,
): string {
  return translateMessage(locale, `api.${key}`);
}
