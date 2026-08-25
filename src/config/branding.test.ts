import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  branding,
  getBrandSlogan,
  getManifestConfig,
  getMeetingRoomName,
  getProductDescription,
  getProductPresentationUrl,
  getSiteMetadata,
} from "./branding.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..");

const FORBIDDEN_PRODUCT_PATTERNS = [
  /Sharp\s*&\s*Spice/i,
  /Sharp-Spice/i,
  /Northstar Mobility Demo/i,
];

const BRANDING_SURFACE_FILES = [
  "src/app/layout.tsx",
  "src/app/login/page.tsx",
  "src/components/ui/Logo.tsx",
  "src/components/pwa/PwaInstallHint.tsx",
  "src/components/meet/GuestMeetingGate.tsx",
  "src/components/meet/GuestMeetRoom.tsx",
  "src/components/dashboard/FirstImpressionView.tsx",
  "public/sw.js",
];

const ALLOWED_NORTHSTAR_CONTEXTS = [
  "companyName",
  "demoCompanyWebsiteUrl",
  "northstar-mobility",
  "Команда ${branding.companyName}",
];

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function isAllowedNorthstarLine(line: string): boolean {
  return ALLOWED_NORTHSTAR_CONTEXTS.some((token) => line.includes(token));
}

describe("branding config", () => {
  it("defines Spiora as product name", () => {
    assert.equal(branding.productName, "Spiora");
    assert.equal(branding.productShortName, "Spiora");
  });

  it("exposes bilingual product descriptions", () => {
    assert.equal(
      getProductDescription("en"),
      "The AI Operating System for Business",
    );
    assert.equal(
      getProductDescription("ru"),
      "AI-операционная система для бизнеса",
    );
  });

  it("exposes brand slogan from brand book", () => {
    assert.equal(
      getBrandSlogan("en"),
      "ONE PLATFORM. INFINITE SOLUTIONS.",
    );
    assert.equal(
      getBrandSlogan("ru"),
      "ONE PLATFORM. INFINITE SOLUTIONS.",
    );
  });

  it("exposes locale-specific Spiora presentation URLs", () => {
    assert.equal(
      getProductPresentationUrl("en"),
      "https://gamma.app/docs/Spiora-presentation-in-English-z3irgedui9m9fgs",
    );
    assert.equal(
      getProductPresentationUrl("ru"),
      "https://gamma.app/docs/-msbuylfh7da9te1",
    );
  });

  it("uses official brand palette", () => {
    assert.equal(branding.primaryColor, "#000000");
    assert.equal(branding.accentColor, "#E82916");
    assert.equal(branding.brandGradientStart, "#F4981A");
    assert.equal(branding.brandGradientEnd, "#E82916");
  });

  it("builds site metadata with Spiora", () => {
    const site = getSiteMetadata();
    assert.equal(site.title, "Spiora");
    assert.match(site.description, /Spiora/);
    assert.equal(site.openGraph.siteName, "Spiora");
  });

  it("builds manifest with Spiora", () => {
    const manifest = getManifestConfig();
    assert.equal(manifest.name, "Spiora");
    assert.equal(manifest.short_name, "Spiora");
    assert.match(manifest.description, /Spiora/);
    assert.equal(manifest.theme_color, branding.accentColor);
  });

  it("uses spiora-cal LiveKit room prefix", () => {
    assert.equal(getMeetingRoomName("evt_demo"), "spiora-cal-evt_demo");
    assert.equal(branding.liveKitRoomPrefix, "spiora-cal");
  });

  it("points assets to logo3.png and icon1-based favicon", () => {
    assert.equal(branding.logoPath, "/logo3.png");
    assert.equal(branding.logoCompactPath, "/logo3-compact.png");
    assert.equal(branding.iconPath, "/icons/icon-512x512.png");
    assert.equal(branding.faviconPath, "/icons/favicon-32x32.png");
  });
});

describe("legacy product branding scan", () => {
  it("does not contain forbidden product names in branding surfaces", () => {
    for (const relativePath of BRANDING_SURFACE_FILES) {
      const content = readRepoFile(relativePath);
      for (const pattern of FORBIDDEN_PRODUCT_PATTERNS) {
        assert.doesNotMatch(
          content,
          pattern,
          `${relativePath} still matches ${pattern}`,
        );
      }
    }
  });

  it("does not use Northstar Mobility as product name in src/public UI surfaces", () => {
    const targets = [...BRANDING_SURFACE_FILES, "src/config/branding.ts"];

    for (const relativePath of targets) {
      const lines = readRepoFile(relativePath).split(/\r?\n/);
      for (const line of lines) {
        if (!line.includes("Northstar Mobility")) continue;
        assert.ok(
          isAllowedNorthstarLine(line),
          `${relativePath} has legacy product branding: ${line.trim()}`,
        );
      }
    }
  });

  it("keeps demo company name separate from product name", () => {
    assert.notEqual(branding.companyName, branding.productName);
    assert.equal(branding.companyName, "Northstar Mobility");
  });
});
