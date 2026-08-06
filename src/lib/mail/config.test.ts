import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getMailConfig, isMailConfigured, parseMailFrom } from "./config";

const KEYS = [
  "SPIORA_ENABLE_EMAIL",
  "BREVO_API_KEY",
  "SENDINBLUE_API_KEY",
  "SPIORA_EMAIL_FROM",
  "SPIORA_EMAIL_FROM_NAME",
  "EMAIL_FROM",
] as const;

const previous = new Map<string, string | undefined>();

function snapshotEnv() {
  for (const key of KEYS) {
    previous.set(key, process.env[key]);
  }
}

function restoreEnv() {
  for (const key of KEYS) {
    const value = previous.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("parseMailFrom", () => {
  it("parses angled address", () => {
    assert.deepEqual(parseMailFrom('Spiora <info@spiora.ai>'), {
      email: "info@spiora.ai",
      name: "Spiora",
    });
  });

  it("parses bare email", () => {
    assert.deepEqual(parseMailFrom("info@spiora.ai"), {
      email: "info@spiora.ai",
      name: "Spiora",
    });
  });
});

describe("mail config", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("is disabled without enable flag", () => {
    snapshotEnv();
    delete process.env.SPIORA_ENABLE_EMAIL;
    process.env.BREVO_API_KEY = "xkeysib-test";
    process.env.SPIORA_EMAIL_FROM = "Spiora <info@spiora.ai>";
    assert.equal(isMailConfigured(), false);
  });

  it("is enabled when flag, Brevo key, and from are set", () => {
    snapshotEnv();
    process.env.SPIORA_ENABLE_EMAIL = "true";
    process.env.BREVO_API_KEY = "xkeysib-test";
    delete process.env.SENDINBLUE_API_KEY;
    process.env.SPIORA_EMAIL_FROM = "Spiora <info@spiora.ai>";
    const config = getMailConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.fromEmail, "info@spiora.ai");
    assert.equal(config.fromName, "Spiora");
  });
});
