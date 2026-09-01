import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectWorkspaceIntent,
  isPassportNumberLookupQuery,
} from "@/lib/ai/query-intent";

describe("detectWorkspaceIntent — Emigrant Desk decoupled from CRM", () => {
  it("does not load Desk for generic client passport question", () => {
    const query = "Какой номер паспорта у клиента Белоус Екатерина?";
    const intent = detectWorkspaceIntent(query);
    assert.equal(intent.needsClients, true);
    assert.equal(intent.needsEmigrantDesk, false);
    assert.equal(intent.fastClientLookup, true);
    assert.equal(isPassportNumberLookupQuery(query), true);
  });

  it("does not treat passport number question as document scan lookup", () => {
    const query = "какой номер паспорта у Белоус Екатерина";
    assert.equal(isPassportNumberLookupQuery(query), true);
    const intent = detectWorkspaceIntent(query);
    assert.equal(intent.needsClients, true);
    assert.equal(intent.fastClientLookup, true);
  });

  it("does not treat passport scan request as CRM passport number lookup", () => {
    assert.equal(isPassportNumberLookupQuery("найди скан паспорта у Белоус"), false);
  });

  it("loads Desk only for explicit cabinet / case status queries", () => {
    const intent = detectWorkspaceIntent(
      "Какой статус дела в кабинете у Белова?",
    );
    assert.equal(intent.needsEmigrantDesk, true);
  });

  it("loads Desk when emigrant desk is mentioned explicitly", () => {
    const intent = detectWorkspaceIntent("статус в emigrant desk");
    assert.equal(intent.needsEmigrantDesk, true);
  });

  it("loads intake for questionnaire / new application queries", () => {
    const intent = detectWorkspaceIntent("Покажи новые анкеты за неделю");
    assert.equal(intent.needsIntake, true);
    assert.equal(intent.needsClients, false);
  });

  it("loads intake detail intent for named questionnaire", () => {
    const intent = detectWorkspaceIntent("Суммируй анкету Белоус Екатерина");
    assert.equal(intent.needsIntake, true);
  });

  it("loads clients for booking lookup without Desk", () => {
    const intent = detectWorkspaceIntent("адрес букинга у Белоус Екатерина");
    assert.equal(intent.needsClients, true);
    assert.equal(intent.fastClientLookup, true);
    assert.equal(intent.needsEmigrantDesk, false);
    assert.equal(intent.needsIntake, true);
  });

  it("loads intake for passport and birth date questions about a named client", () => {
    const query = "номер паспорта Майя Петрова и когда она родилась";
    const intent = detectWorkspaceIntent(query);
    assert.equal(intent.needsIntake, true);
    assert.equal(intent.fastClientLookup, true);
    assert.equal(isPassportNumberLookupQuery(query), true);
  });

  it("loads intake for citizenship questions about a named client", () => {
    const query = "У Лиам Морган какое гражданство?";
    const intent = detectWorkspaceIntent(query);
    assert.equal(intent.needsIntake, true);
    assert.equal(intent.needsClients, true);
  });

  it("loads intake for address questions about a named client", () => {
    const query = "Какой адрес у Новак Матео";
    const intent = detectWorkspaceIntent(query);
    assert.equal(intent.needsIntake, true);
    assert.equal(intent.fastClientLookup, true);
  });
});
