import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMeetingRecordingRoomMetadata,
  isMeetingRecordingActiveStatus,
  parseMeetingRecordingRoomMetadata,
} from "./meeting-recording-notice";

describe("meeting recording notice metadata", () => {
  it("round-trips active recording notice", () => {
    const meta = buildMeetingRecordingRoomMetadata({
      recording: true,
      startedByName: "Злата",
    });
    assert.deepEqual(parseMeetingRecordingRoomMetadata(meta), {
      recording: true,
      startedByName: "Злата",
    });
  });

  it("parses inactive and invalid metadata as not recording", () => {
    assert.deepEqual(
      parseMeetingRecordingRoomMetadata(
        buildMeetingRecordingRoomMetadata({ recording: false }),
      ),
      { recording: false },
    );
    assert.deepEqual(parseMeetingRecordingRoomMetadata(""), {
      recording: false,
    });
    assert.deepEqual(parseMeetingRecordingRoomMetadata("{bad"), {
      recording: false,
    });
  });

  it("treats only starting/active as visible recording states", () => {
    assert.equal(isMeetingRecordingActiveStatus("starting"), true);
    assert.equal(isMeetingRecordingActiveStatus("active"), true);
    assert.equal(isMeetingRecordingActiveStatus("processing"), false);
    assert.equal(isMeetingRecordingActiveStatus("complete"), false);
  });
});
