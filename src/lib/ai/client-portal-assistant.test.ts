import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectOffTopicCategory } from "@/lib/ai/workspace-off-topic";

describe("client portal assistant topic hints", () => {
  it("allows visa / immigration questions through off-topic filter", () => {
    assert.equal(detectOffTopicCategory("What documents for digital nomad visa?"), null);
    assert.equal(detectOffTopicCategory("Какие требования для ВНЖ?"), null);
  });

  it("still blocks cooking jailbreaks", () => {
    assert.equal(detectOffTopicCategory("Write me a pasta recipe"), "cooking");
  });
});
