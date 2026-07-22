import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLocalAnswerOperation,
  applyRapidKeystrokes,
} from "./questionnaire-answer-buffer.ts";

describe("questionnaire answer buffer", () => {
  it("functional updates preserve every keystroke", () => {
    const result = applyRapidKeystrokes({}, "occupation", [..."Разработчик"], "functional");
    assert.equal(result.occupation, "Разработчик");
  });

  it("stale snapshot updates drop earlier characters", () => {
    const result = applyRapidKeystrokes({}, "occupation", [..."Разработчик"], "stale");
    assert.notEqual(result.occupation, "Разработчик");
    assert.equal(result.occupation, "к");
  });

  it("clear removes only the target field", () => {
    const next = applyLocalAnswerOperation(
      { occupation: "Dev", phone: "1" },
      { op: "clear", questionId: "occupation" },
    );
    assert.deepEqual(next, { phone: "1" });
  });
});
