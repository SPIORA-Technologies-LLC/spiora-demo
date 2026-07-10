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
import { translateClientStatus } from "./statuses.ts";

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

describe("core modules i18n — Dashboard", () => {
  it("возвращает английские dashboard labels", () => {
    assert.equal(translateMessage("en", "dashboard.pageTitle"), "Dashboard");
    assert.equal(
      translateMessage("en", "dashboard.hero.welcome"),
      "Welcome, {name}",
    );
    assert.equal(
      translateMessage("en", "dashboard.platformStats.clients"),
      "Clients",
    );
    assert.equal(
      translateMessage("en", "dashboard.quickActions.createTask"),
      "Create task",
    );
  });

  it("возвращает русские dashboard labels", () => {
    assert.equal(
      translateMessage("ru", "dashboard.hero.welcome"),
      "Добро пожаловать, {name}",
    );
    assert.equal(
      translateMessage("ru", "dashboard.platformStats.clients"),
      "Клиенты",
    );
    assert.equal(
      translateMessage("ru", "dashboard.sections.quickActions"),
      "Быстрые действия",
    );
  });
});

describe("core modules i18n — Clients", () => {
  it("возвращает английские clients labels", () => {
    assert.equal(translateMessage("en", "clients.title"), "Clients");
    assert.equal(
      translateMessage("en", "clients.search.placeholder"),
      "Search: name, passport…",
    );
    assert.equal(
      translateMessage("en", "clients.empty.notFound"),
      "No clients found",
    );
    assert.equal(
      translateMessage("en", "clients.detail.backToList"),
      "Back to clients",
    );
  });

  it("возвращает русские clients labels", () => {
    assert.equal(translateMessage("ru", "clients.title"), "Клиенты");
    assert.equal(
      translateMessage("ru", "clients.empty.notFound"),
      "Клиенты не найдены",
    );
    assert.equal(
      translateMessage("ru", "clients.notes.add"),
      "Добавить заметку",
    );
  });

  it("локализует API-сообщения", () => {
    assert.equal(translateMessage("en", "api.unauthorized"), "Access denied");
    assert.equal(translateMessage("ru", "api.notFound"), "Не найдено");
    assert.equal(
      translateMessage("ru", "api.noteSaveFailed"),
      "Не удалось сохранить заметку",
    );
  });
});

describe("core modules i18n — statuses", () => {
  it("переводит статусы клиентов одинаково из разных источников", () => {
    assert.equal(translateClientStatus("en", "New"), "New");
    assert.equal(translateClientStatus("en", "Новый"), "New");
    assert.equal(translateClientStatus("ru", "In progress"), "В работе");
    assert.equal(translateClientStatus("ru", "В работе"), "В работе");
    assert.equal(translateClientStatus("en", "Consultation"), "Consultation");
    assert.equal(translateClientStatus("ru", "Консультация"), "Консультация");
  });

  it("использует fallback для неизвестного статуса", () => {
    assert.equal(translateClientStatus("en", "Custom status"), "Custom status");
  });
});

describe("core modules i18n — locale preservation", () => {
  it("сохраняет маршрут карточки клиента при смене языка", () => {
    assert.equal(
      buildPreserveRouteUrl("/clients/demo-001", "tab=notes"),
      "/clients/demo-001?tab=notes",
    );
  });

  it("сохраняет query поиска клиентов при смене языка", () => {
    assert.equal(
      buildPreserveRouteUrl("/clients", "search=ann&page=2"),
      "/clients?search=ann&page=2",
    );
  });
});
