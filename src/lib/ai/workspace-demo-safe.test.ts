import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import {
  buildDemoSafeBlockedResponse,
  containsDiagnosticMetadata,
  formatDemoClientLookupMessage,
  isWorkspaceDiagnosticsEnabled,
  stripClientContextForDemoPublic,
  toDemoSafeDiagnosticResponse,
} from "./workspace-demo-safe.ts";

describe("workspace demo-safe formatter", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("включает diagnostics вне demo mode", () => {
    delete process.env.SPIORA_DEMO_MODE;
    assert.equal(isWorkspaceDiagnosticsEnabled(), true);
  });

  it("скрывает diagnostics в demo mode без debug-флага", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    delete process.env.SPIORA_AI_WORKSPACE_DEBUG;
    assert.equal(isWorkspaceDiagnosticsEnabled(), false);
  });

  it("возвращает diagnostics в demo mode с SPIORA_AI_WORKSPACE_DEBUG=true", () => {
    process.env.SPIORA_DEMO_MODE = "true";
    process.env.SPIORA_AI_WORKSPACE_DEBUG = "true";
    assert.equal(isWorkspaceDiagnosticsEnabled(), true);
  });

  it("EN: безопасный текст при найденном клиенте", () => {
    assert.equal(
      formatDemoClientLookupMessage("en", true),
      "Demo client data was found.",
    );
  });

  it("EN: безопасный текст при отсутствии клиента", () => {
    assert.equal(
      formatDemoClientLookupMessage("en", false),
      "No matching demo client was found.",
    );
  });

  it("RU: безопасный текст при найденном клиенте", () => {
    assert.equal(
      formatDemoClientLookupMessage("ru", true),
      "Демонстрационные данные клиента найдены.",
    );
  });

  it("RU: безопасный текст при отсутствии клиента", () => {
    assert.equal(
      formatDemoClientLookupMessage("ru", false),
      "Подходящий демонстрационный клиент не найден.",
    );
  });

  it("demo diagnostic API response не содержит resultKind и score", () => {
    const payload = toDemoSafeDiagnosticResponse("en", true);
    assert.equal(payload.demo, true);
    assert.equal(containsDiagnosticMetadata(payload), false);
    assert.doesNotMatch(JSON.stringify(payload), /resultKind|topScore|debugRow/i);
  });

  it("blocked diagnostic response не возвращает Google Sheets diagnostic object", () => {
    const payload = buildDemoSafeBlockedResponse("ru");
    assert.equal(payload.demo, true);
    assert.equal(containsDiagnosticMetadata(payload), false);
    assert.ok(!("clientsTable" in payload));
    assert.ok(!("recentSearches" in payload));
    assert.match(payload.message, /Диагностика недоступна/);
  });

  it("stripClientContextForDemoPublic убирает score и debugRow", () => {
    const stripped = stripClientContextForDemoPublic({
      source: "clients",
      sourceLabel: "CRM",
      rowIndex: 3,
      name: "Sofia Martins",
      phone: "+000",
      email: "sofia@example.com",
      country: "Spain",
      direction: "Spain",
      status: "Consultation",
      manager: "Emma Wilson",
      lastActivity: "2026-05-27",
      surveyData: "",
      score: 92,
      matchedFields: ["name", "email"],
      debugRow: { passport: "SECRET" },
    });

    assert.equal(stripped.score, 0);
    assert.deepEqual(stripped.matchedFields, []);
    assert.deepEqual(stripped.debugRow, {});
    assert.equal(containsDiagnosticMetadata(stripped), false);
  });
});

describe("workspace debug command demo safety", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    process.env.SPIORA_DEMO_MODE = "true";
    delete process.env.SPIORA_AI_WORKSPACE_DEBUG;
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("debug metadata не попадает в ответ /debug_client в demo mode", async () => {
    const { runWorkspaceAi } = await import("./workspace-assistant.ts");
    const result = await runWorkspaceAi("/debug_client Sofia", [], "brief", null, "en");

    assert.match(result.reply, /Demo client data was found/i);
    assert.doesNotMatch(result.reply, /debug_client|score|resultKind|Raw scan/i);
    assert.equal(result.demo, true);
  });
});
