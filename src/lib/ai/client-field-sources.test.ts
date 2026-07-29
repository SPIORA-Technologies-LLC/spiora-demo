import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientContext, MergedClientContext } from "@/lib/ai/client-context";
import {
  buildManagerSourceSummary,
  formatMergedClientContextWithSources,
  resolveClientContextAttribution,
} from "@/lib/ai/client-field-sources";

function ctx(
  partial: Partial<ClientContext> & Pick<ClientContext, "source" | "name">,
): ClientContext {
  return {
    sourceLabel: "Клиенты",
    rowIndex: partial.rowIndex ?? 1,
    phone: "",
    email: "",
    country: "",
    direction: "",
    status: "",
    manager: "",
    lastActivity: "",
    surveyData: "",
    score: 50,
    matchedFields: [],
    debugRow: {},
    ...partial,
  };
}

describe("resolveClientContextAttribution", () => {
  it("attributes CRM contacts and Desk case number", () => {
    const crm = ctx({
      source: "clients",
      name: "Давлятова Лола",
      status: "В работе",
      email: "demo.client.f@example.com",
      phone: "79099550114",
      debugRow: { passport: "762762123" },
    });

    const attribution = resolveClientContextAttribution([crm], {
      name: "Давлятова Лола Бахтиёровна",
      email: "demo.client.f@example.com",
      caseNumber: "765946434",
      currentStatus: "Документы поданы",
      consulate: "",
      submissionCity: "",
      submissionDate: "",
      statusUpdatedAt: "",
      internalComment: "",
    });

    assert.deepEqual(attribution.activeSources, ["CRM", "Emigrant Desk"]);
    assert.equal(
      attribution.fields.find((field) => field.label === "Email")?.source,
      "CRM",
    );
    assert.equal(
      attribution.fields.find((field) => field.label === "Статус")?.source,
      "CRM",
    );
    assert.equal(
      attribution.fields.find((field) => field.label === "Номер дела")?.value,
      "765946434",
    );
    assert.match(attribution.managerSummary, /CRM.*Emigrant Desk|Клиенты/);
    assert.match(attribution.managerSummary, /Emigrant Desk/);
  });

  it("includes latin, partner and contract from CRM debug row", () => {
    const crm = ctx({
      source: "clients",
      name: "Белоус Екатерина",
      debugRow: {
        latinName: "Belavus Katsiaryna",
        partner: "ЛЕНА МОСКВА",
        contract: "дог.оказания услуг",
      },
    });

    const attribution = resolveClientContextAttribution([crm]);
    assert.equal(
      attribution.fields.find((field) => field.label === "Латиница")?.value,
      "Belavus Katsiaryna",
    );
    assert.equal(
      attribution.fields.find((field) => field.label === "Партнер от кого клиент")
        ?.value,
      "ЛЕНА МОСКВА",
    );
    assert.equal(
      attribution.fields.find((field) => field.label === "Договор")?.value,
      "дог.оказания услуг",
    );
  });

  it("includes CRM table dates and booking fields from debug row", () => {
    const crm = ctx({
      source: "clients",
      name: "Иванова",
      debugRow: {
        submittedAt: "15.03.2025",
        expectedApprovalAt: "20.06.2025",
        approvalAt: "18.06.2025",
        residenceCardIssuedAt: "01.07.2025",
        bookingAddress: "Zagreb",
        bookingRange: "10.06–12.06",
        notes: "Ждёт карту",
      },
    });

    const attribution = resolveClientContextAttribution([crm]);
    assert.equal(
      attribution.fields.find((field) => field.label === "Дата подачи")?.value,
      "15.03.2025",
    );
    assert.equal(
      attribution.fields.find(
        (field) => field.label === "Дата выдачи карточки ВНЖ",
      )?.value,
      "01.07.2025",
    );
    assert.equal(
      attribution.fields.find((field) => field.label === "Адрес букинга")?.value,
      "Zagreb",
    );
  });

  it("detects phone conflicts between duplicate CRM rows", () => {
    const left = ctx({
      source: "clients",
      name: "Иванов",
      phone: "79001112233",
      rowIndex: 1,
    });
    const right = ctx({
      source: "clients",
      name: "Иванов Иван",
      phone: "79009998877",
      rowIndex: 2,
    });

    const attribution = resolveClientContextAttribution([left, right]);
    const phoneConflict = attribution.conflicts.find(
      (conflict) => conflict.field === "Телефон",
    );
    assert.ok(phoneConflict);
    assert.equal(phoneConflict?.values.length, 2);
  });
});

describe("formatMergedClientContextWithSources", () => {
  it("includes source checklist and field origins", () => {
    const merged: MergedClientContext = {
      source: "merged",
      sourceLabel: "Объединённый",
      rowIndex: 2,
      name: "Давлятова Лола Бахтиёровна",
      phone: "79099550114",
      email: "demo.client.f@example.com",
      country: "",
      direction: "Хорватия",
      status: "В работе",
      manager: "",
      lastActivity: "",
      surveyData: "CRM row detail",
      crmData: "CRM row",
      score: 80,
      matchedFields: [],
      mergeReasons: ["passport"],
      parts: [
        ctx({
          source: "clients",
          name: "Давлятова Лола",
          status: "В работе",
          rowIndex: 2,
        }),
        ctx({
          source: "clients",
          name: "Давлятова Лола Бахтиёровна",
          email: "demo.client.f@example.com",
          phone: "79099550114",
          rowIndex: 5,
        }),
      ],
      conflicts: [],
      debugRow: {},
    };

    const text = formatMergedClientContextWithSources(merged);
    assert.match(text, /✅ CRM/);
    assert.match(text, /⬜ Emigrant Desk/);
    assert.match(text, /Email:\ndemo.client.f@example.com\nИсточник: CRM/);
    assert.match(text, /Технические блоки по источникам/);
  });
});

describe("buildManagerSourceSummary", () => {
  it("formats two-source summary", () => {
    assert.equal(
      buildManagerSourceSummary(["CRM", "Emigrant Desk"]),
      "Данные объединены из CRM и Emigrant Desk.",
    );
  });
});
