import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MEETING_BACKGROUND_PRESETS,
  resolveMeetingBackgroundMode,
} from "./meeting-backgrounds";

describe("meeting backgrounds", () => {
  it("includes Spiora image presets", () => {
    const ids = MEETING_BACKGROUND_PRESETS.map((preset) => preset.id);
    assert.deepEqual(ids, [
      "none",
      "blur",
      "spiora-office",
      "spiora-brand-wall",
      "spiora-desk",
    ]);

    for (const id of ["spiora-office", "spiora-brand-wall", "spiora-desk"] as const) {
      const preset = MEETING_BACKGROUND_PRESETS.find((item) => item.id === id);
      assert.ok(preset?.imagePath);
      assert.equal(preset?.imagePath, `/meeting-backgrounds/${id}.jpg`);
    }
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
    assert.deepEqual(resolveMeetingBackgroundMode("spiora-brand-wall"), {
      type: "image",
      imagePath: "/meeting-backgrounds/spiora-brand-wall.jpg",
    });
    assert.deepEqual(resolveMeetingBackgroundMode("spiora-desk"), {
      type: "image",
      imagePath: "/meeting-backgrounds/spiora-desk.jpg",
    });
    assert.deepEqual(resolveMeetingBackgroundMode("none"), { type: "none" });
  });
});
