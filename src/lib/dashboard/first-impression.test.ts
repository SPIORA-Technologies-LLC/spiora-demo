import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  branding,
  getBrandSlogan,
  getProductDescription,
} from "@/config/branding.ts";
import {
  ASK_SPIORA_CHIPS,
  COMPANY_HEALTH,
  PRIORITY_CARDS,
  TEAM_ACTIVITY,
} from "@/lib/dashboard/first-impression-seed.ts";
import { translateMessage } from "@/i18n/messages.ts";

describe("PR #12 — First Impression branding", () => {
  it("использует logo2.svg везде", () => {
    assert.equal(branding.logoPath, "/logo2.svg");
    assert.equal(branding.iconPath, "/logo2.svg");
    assert.equal(branding.faviconPath, "/logo2.svg");
  });

  it("brand slogan — logo / splash", () => {
    assert.equal(
      getBrandSlogan("en"),
      "ONE PLATFORM. INFINITE SOLUTIONS.",
    );
  });

  it("product positioning EN", () => {
    assert.equal(
      getProductDescription("en"),
      "The AI Operating System for Business",
    );
  });

  it("product positioning RU", () => {
    assert.match(getProductDescription("ru"), /AI/);
    assert.match(getProductDescription("ru"), /бизнес/i);
  });
});

describe("PR #12 — Command Center i18n", () => {
  it("EN: Command Center nav и hero", () => {
    assert.equal(translateMessage("en", "nav.dashboard"), "Command Center");
    assert.match(
      translateMessage("en", "commandCenter.greeting"),
      /Good morning, \{name\}/,
    );
    assert.equal(
      translateMessage("en", "commandCenter.calmHeadline"),
      "Everything is under control.",
    );
  });

  it("RU: Центр управления", () => {
    assert.equal(
      translateMessage("ru", "nav.dashboard"),
      "Центр управления",
    );
    assert.match(
      translateMessage("ru", "commandCenter.greeting"),
      /Доброе утро, \{name\}/,
    );
  });

  it("owner-speak priorities без технических слов Tasks/Events", () => {
    const meetings = translateMessage("en", "commandCenter.priorities.meetings");
    assert.doesNotMatch(meetings, /\bTasks\b/i);
    assert.doesNotMatch(meetings, /\bEvents\b/i);
    assert.doesNotMatch(meetings, /\bRecords\b/i);
  });
});

describe("PR #12 — First Impression demo seed", () => {
  it("Company Health synthetic scale", () => {
    assert.ok(COMPANY_HEALTH.clients >= 100);
    assert.ok(COMPANY_HEALTH.documents >= 1000);
    assert.equal(COMPANY_HEALTH.statusKey, "excellent");
  });

  it("4 priority cards", () => {
    assert.equal(PRIORITY_CARDS.length, 4);
  });

  it("Ask Spiora chips для demo navigation", () => {
    assert.ok(ASK_SPIORA_CHIPS.length >= 5);
    for (const chip of ASK_SPIORA_CHIPS) {
      assert.ok(chip.href.startsWith("/"));
    }
  });

  it("Team Activity feed", () => {
    assert.ok(TEAM_ACTIVITY.length >= 5);
  });
});
