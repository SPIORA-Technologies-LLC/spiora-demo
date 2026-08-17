import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  defaultTransactionalEmailHtml,
  wrapTransactionalEmailHtml,
} from "./branded-html";

const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (previousAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
});

describe("wrapTransactionalEmailHtml", () => {
  it("puts the SPIORA app icon above the message", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.spiora.ai";
    const html = wrapTransactionalEmailHtml("<p>Hello</p>");
    assert.match(html, /https:\/\/www\.spiora\.ai\/icons\/icon-192x192\.png/);
    assert.match(html, /alt="SPIORA"/);
    assert.match(html, /<p>Hello<\/p>/);
  });
});

describe("defaultTransactionalEmailHtml", () => {
  it("escapes plaintext and still includes the icon", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://www.spiora.ai";
    const html = defaultTransactionalEmailHtml("<script>x</script>");
    assert.match(html, /\/icons\/icon-192x192\.png/);
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>x<\/script>/);
  });
});
