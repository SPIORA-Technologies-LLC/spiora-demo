import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectLiveKitFileResults,
  liveKitDurationToSeconds,
  liveKitFileSizeToBytes,
} from "./meeting-recording-duration";

describe("liveKitDurationToSeconds", () => {
  it("converts nanoseconds to whole seconds", () => {
    assert.equal(liveKitDurationToSeconds(600_000_000_000n), 600);
    assert.equal(liveKitDurationToSeconds(90_500_000_000), 91);
  });

  it("keeps small second-scale mocks as seconds", () => {
    assert.equal(liveKitDurationToSeconds(60), 60);
  });

  it("rejects overflow and invalid values", () => {
    assert.equal(liveKitDurationToSeconds(-1), null);
    assert.equal(liveKitDurationToSeconds(Number.POSITIVE_INFINITY), null);
    assert.equal(liveKitDurationToSeconds(null), null);
  });
});

describe("liveKitFileSizeToBytes", () => {
  it("accepts bigint file sizes", () => {
    assert.equal(liveKitFileSizeToBytes(12_345_678n), 12_345_678);
  });
});

describe("collectLiveKitFileResults", () => {
  it("prefers fileResults when present", () => {
    const files = collectLiveKitFileResults({
      fileResults: [{ filename: "a.mp4", duration: 1n }],
      result: { case: "file", value: { filename: "b.mp4" } },
    });
    assert.equal(files[0]?.filename, "a.mp4");
  });

  it("falls back to deprecated result.file", () => {
    const files = collectLiveKitFileResults({
      fileResults: [],
      result: {
        case: "file",
        value: { filename: "legacy.mp4", duration: 5_000_000_000n },
      },
    });
    assert.equal(files[0]?.filename, "legacy.mp4");
  });
});
