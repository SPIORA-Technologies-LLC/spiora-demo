import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOCALE_COOKIE_NAME,
  buildPreserveRouteUrl,
  defaultLocale,
  getHtmlLang,
  parseLocale,
} from "./config.ts";
import { resolveLocaleFromSources } from "./locale.ts";
import {
  formatAppDate,
  formatAppNumber,
  getMonthNames,
  getWeekdayNames,
} from "./format.ts";
import {
  getMessageFallback,
  getMessagesForLocale,
  translateMessage,
} from "./messages.ts";

describe("i18n config", () => {
  it("использует English по умолчанию", () => {
    assert.equal(defaultLocale, "en");
    assert.equal(parseLocale(undefined), "en");
    assert.equal(parseLocale(null), "en");
    assert.equal(parseLocale("invalid"), "en");
  });

  it("переключается на русский locale", () => {
    assert.equal(parseLocale("ru"), "ru");
    assert.equal(getHtmlLang("ru"), "ru");
  });

  it("использует cookie SPIORA_LOCALE", () => {
    assert.equal(LOCALE_COOKIE_NAME, "SPIORA_LOCALE");
  });

  it("восстанавливает язык из cookie после перезагрузки", () => {
    assert.equal(resolveLocaleFromSources("en", "ru"), "ru");
    assert.equal(resolveLocaleFromSources(null, "ru"), "ru");
    assert.equal(resolveLocaleFromSources("ru", null), "ru");
  });

  it("сохраняет маршрут и query при смене языка", () => {
    assert.equal(buildPreserveRouteUrl("/tasks", "status=open"), "/tasks?status=open");
    assert.equal(buildPreserveRouteUrl("/dashboard", ""), "/dashboard");
    assert.equal(
      buildPreserveRouteUrl("/clients", new URLSearchParams("q=ann")),
      "/clients?q=ann",
    );
  });
});

describe("i18n messages", () => {
  it("возвращает английские shared navigation labels", () => {
    assert.equal(translateMessage("en", "nav.dashboard"), "Dashboard");
    assert.equal(translateMessage("en", "nav.clients"), "Clients");
    assert.equal(translateMessage("en", "nav.logout"), "Logout");
  });

  it("возвращает русские shared navigation labels", () => {
    assert.equal(translateMessage("ru", "nav.clients"), "Клиенты");
    assert.equal(translateMessage("ru", "nav.tasks"), "Задачи");
    assert.equal(translateMessage("ru", "nav.logout"), "Выйти");
  });

  it("делает fallback на английский для отсутствующего ключа", () => {
    assert.equal(
      getMessageFallback("actions.save"),
      translateMessage("en", "actions.save"),
    );
    assert.equal(
      translateMessage("ru", "nav.nonexistentKey"),
      "nav.nonexistentKey",
    );
  });

  it("загружает словари для en и ru", () => {
    const enMessages = getMessagesForLocale("en");
    const ruMessages = getMessagesForLocale("ru");
    assert.equal((enMessages.nav as { dashboard: string }).dashboard, "Dashboard");
    assert.equal((ruMessages.nav as { dashboard: string }).dashboard, "Dashboard");
    assert.equal((ruMessages.nav as { clients: string }).clients, "Клиенты");
  });
});

describe("i18n formatting", () => {
  const sampleDate = new Date("2026-07-10T15:30:00.000Z");

  it("форматирует дату для en", () => {
    const formatted = formatAppDate(sampleDate, "en", {
      dateStyle: "medium",
      timeZone: "UTC",
    });
    assert.match(formatted, /Jul/);
  });

  it("форматирует дату для ru", () => {
    const formatted = formatAppDate(sampleDate, "ru", {
      dateStyle: "medium",
      timeZone: "UTC",
    });
    assert.match(formatted, /июл/i);
  });

  it("форматирует числа для en и ru", () => {
    assert.equal(formatAppNumber(12345.6, "en"), "12,345.6");
    assert.match(formatAppNumber(12345.6, "ru"), /12/);
  });

  it("возвращает локализованные дни недели и месяцы", () => {
    const enWeekdays = getWeekdayNames("en", "long");
    const ruWeekdays = getWeekdayNames("ru", "long");
    assert.equal(enWeekdays.length, 7);
    assert.equal(ruWeekdays.length, 7);
    assert.notEqual(enWeekdays[0], ruWeekdays[0]);

    const enMonths = getMonthNames("en", "long");
    const ruMonths = getMonthNames("ru", "long");
    assert.equal(enMonths[0], "January");
    assert.match(ruMonths[0], /январ/i);
  });
});

describe("html lang", () => {
  it("устанавливает lang=en и lang=ru", () => {
    assert.equal(getHtmlLang("en"), "en");
    assert.equal(getHtmlLang("ru"), "ru");
  });
});
