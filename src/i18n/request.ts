import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE_NAME } from "./config";
import { resolveLocaleFromSources } from "./locale";
import { getMessageFallback, getMessagesForLocale } from "./messages";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE_NAME)?.value;
  const locale = resolveLocaleFromSources(requested, cookieLocale);

  return {
    locale,
    messages: getMessagesForLocale(locale),
    onError(error) {
      if (error.code === "MISSING_MESSAGE") {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[i18n] ${error.message}`);
        }
        return;
      }
      throw error;
    },
    getMessageFallback({ namespace, key }) {
      const path = namespace ? `${namespace}.${key}` : key;
      return getMessageFallback(path);
    },
  };
});
