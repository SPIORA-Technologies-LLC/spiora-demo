import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-core";
import { Track } from "livekit-client";
import {
  isLocalScreenShareTrack,
  pickCameraTracks,
  pickRemoteScreenShareTrack,
  pickScreenShareTrack,
  resolveSpeakerCarouselTracks,
  resolveSpeakerFocusTrack,
} from "./meeting-speaker-focus";

function track(
  identity: string,
  source: Track.Source = Track.Source.Camera,
): TrackReferenceOrPlaceholder {
  return {
    source,
    participant: { identity },
  } as TrackReferenceOrPlaceholder;
}

function speaker(identity: string) {
  return { identity } as Parameters<typeof resolveSpeakerFocusTrack>[0]["activeSpeakers"][number];
}

describe("meeting speaker focus", () => {
  it("picks camera and screen share tracks", () => {
    const tracks = [
      track("a"),
      track("b", Track.Source.ScreenShare),
      track("c"),
    ];

    assert.equal(pickCameraTracks(tracks).length, 2);
    assert.equal(pickScreenShareTrack(tracks)?.participant.identity, "b");
  });

  it("prioritizes remote screen share over active speaker", () => {
    const cameras = [track("a"), track("b")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      screenShareTrack: track("share", Track.Source.ScreenShare),
      activeSpeakers: [speaker("b")],
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.source, Track.Source.ScreenShare);
  });

  it("does not put local screen share on the main stage", () => {
    const cameras = [track("a"), track("b")];
    const localShare = track("a", Track.Source.ScreenShare);
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      screenShareTrack: localShare,
      activeSpeakers: [speaker("b")],
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "b");
    assert.equal(isLocalScreenShareTrack(localShare, "a"), true);
    assert.equal(
      pickRemoteScreenShareTrack([localShare, track("b")], "a")?.participant
        .identity,
      undefined,
    );
  });

  it("follows the loudest active speaker over pin", () => {
    const cameras = [track("a"), track("b"), track("c")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      pinnedTrack: track("a"),
      activeSpeakers: [speaker("c"), speaker("a")],
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "c");
  });

  it("uses pin when nobody is speaking", () => {
    const cameras = [track("a"), track("b")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      pinnedTrack: track("b"),
      activeSpeakers: [],
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "b");
  });

  it("follows the loudest active speaker", () => {
    const cameras = [track("a"), track("b"), track("c")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      activeSpeakers: [speaker("c"), speaker("a")],
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "c");
  });

  it("keeps the last active speaker when the room goes quiet", () => {
    const cameras = [track("a"), track("b"), track("c")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      activeSpeakers: [],
      lastActiveSpeakerIdentity: "c",
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "c");
  });

  it("prefers pin over last active speaker when nobody is talking", () => {
    const cameras = [track("a"), track("b"), track("c")];
    const focus = resolveSpeakerFocusTrack({
      cameraTracks: cameras,
      pinnedTrack: track("b"),
      activeSpeakers: [],
      lastActiveSpeakerIdentity: "c",
      localParticipantIdentity: "a",
    });

    assert.equal(focus?.participant.identity, "b");
  });

  it("keeps all cameras in the filmstrip during screen share", () => {
    const cameras = [track("a"), track("b")];
    const carousel = resolveSpeakerCarouselTracks(
      cameras,
      track("share", Track.Source.ScreenShare),
    );

    assert.equal(carousel.length, 2);
  });

  it("hides the focused camera from the filmstrip", () => {
    const cameras = [track("a"), track("b"), track("c")];
    const carousel = resolveSpeakerCarouselTracks(cameras, track("b"));

    assert.deepEqual(
      carousel.map((item) => item.participant.identity),
      ["a", "c"],
    );
  });
});
