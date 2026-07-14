import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { brandColors, branding } from "@/config/branding.ts";

const ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

const FORBIDDEN_LEGACY_COLORS = [
  "#910d0d",
  "#b32424",
  "#6d0a0a",
  "#ff9a03",
  "#1a202c",
  "#2d3748",
  "#0f141c",
  "rgba(145, 13, 13",
  "font-family: Sora",
];

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function walkCssFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkCssFiles(full));
    } else if (entry.name.endsWith(".css")) {
      files.push(full);
    }
  }
  return files;
}

describe("PR #12.5 — Brand System", () => {
  it("defines official brand book palette", () => {
    assert.equal(brandColors.black, "#000000");
    assert.equal(brandColors.red, "#E82916");
    assert.equal(brandColors.orange, "#F4981A");
  });

  it("uses logo2.svg as sole logo asset", () => {
    assert.equal(branding.logoPath, "/logo2.svg");
    assert.equal(branding.logoCompactPath, "/logo2-compact.svg");
    assert.ok(fs.existsSync(path.join(ROOT, "public", "logo2.svg")));
    assert.ok(fs.existsSync(path.join(ROOT, "public", "logo2-compact.svg")));
    assert.ok(fs.existsSync(path.join(ROOT, "logo2.svg")));
    assert.equal(fs.existsSync(path.join(ROOT, "public", "spiora-logo.svg")), false);
    assert.equal(fs.existsSync(path.join(ROOT, "public", "spiora-mark.svg")), false);
  });

  it("separates brand slogan from product positioning", () => {
    assert.equal(
      branding.brandSlogan.en,
      "ONE PLATFORM. INFINITE SOLUTIONS.",
    );
    assert.equal(
      branding.productDescription.en,
      "The AI Operating System for Business",
    );
    assert.notEqual(
      branding.brandSlogan.en,
      branding.productDescription.en,
    );
  });

  it("exposes brand tokens in globals.css", () => {
    const globals = readRepoFile("src/app/globals.css");
    assert.match(globals, /--brand-black:\s*#000000/);
    assert.match(globals, /--brand-red:\s*#e82916/);
    assert.match(globals, /--brand-orange:\s*#f4981a/);
    assert.match(globals, /--font-brand:\s*Raleway/);
    assert.match(globals, /--letter-spacing-brand:\s*0\.25em/);
    assert.match(globals, /--space-1:\s*8px/);
    assert.match(globals, /--space-5:\s*48px/);
  });

  it("does not use legacy non-brand colors in src CSS", () => {
    const cssFiles = walkCssFiles(path.join(ROOT, "src"));
    for (const file of cssFiles) {
      const content = fs.readFileSync(file, "utf8");
      const relative = path.relative(ROOT, file).replace(/\\/g, "/");
      for (const forbidden of FORBIDDEN_LEGACY_COLORS) {
        assert.equal(
          content.includes(forbidden),
          false,
          `${relative} still contains legacy color: ${forbidden}`,
        );
      }
    }
  });
});
