import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialQuestionnaireSaveState } from "./questionnaire-save-state.ts";

describe("initialQuestionnaireSaveState", () => {
  it("returns idle for not_started questionnaire with no save metadata", () => {
    assert.equal(
      initialQuestionnaireSaveState({
        id: null,
        status: "not_started",
        revision: null,
        lastSavedAt: null,
      }),
      "idle",
    );
  });

  it("returns saved when lastSavedAt is present after reload", () => {
    assert.equal(
      initialQuestionnaireSaveState({
        id: "q1",
        status: "draft",
        revision: 2,
        lastSavedAt: "2026-07-22T12:00:00.000Z",
      }),
      "saved",
    );
  });

  it("returns saved when revision exists even if lastSavedAt is missing", () => {
    assert.equal(
      initialQuestionnaireSaveState({
        id: "q1",
        status: "draft",
        revision: 1,
        lastSavedAt: null,
      }),
      "saved",
    );
  });
});
