import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEETING_BACKGROUND_PRESETS,
  resolveMeetingBackgroundMode,
} from "./meeting-backgrounds";

describe("meeting backgrounds", () => {
  it("includes the Spiora office preset", () => {
    const office = MEETING_BACKGROUND_PRESETS.find(
      (preset) => preset.id === "spiora-office",
    );

    assert.ok(office);
    assert.equal(office?.imagePath, "/meeting-backgrounds/spiora-office.jpg");
  });

  it("resolves blur and image modes", () => {
    assert.deepEqual(resolveMeetingBackgroundMode("blur"), {
      type: "blur",
      blurRadius: 12,
    });
    assert.deepEqual(resolveMeetingBackgroundMode("spiora-office"), {
      type: "image",
      imagePath: "/meeting-backgrounds/spiora-office.jpg",
    });
    assert.deepEqual(resolveMeetingBackgroundMode("none"), { type: "none" });
  });
});
