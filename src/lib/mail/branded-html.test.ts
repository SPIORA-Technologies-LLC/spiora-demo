import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultTransactionalEmailHtml,
  wrapTransactionalEmailHtml,
} from "./branded-html";

describe("wrapTransactionalEmailHtml", () => {
  it("wraps the message without embedding an app icon", () => {
    const html = wrapTransactionalEmailHtml("<p>Hello</p>");
    assert.match(html, /<p>Hello<\/p>/);
    assert.doesNotMatch(html, /\/icons\//);
    assert.doesNotMatch(html, /<img\b/i);
  });
});

describe("defaultTransactionalEmailHtml", () => {
  it("escapes plaintext and does not embed an app icon", () => {
    const html = defaultTransactionalEmailHtml("<script>x</script>");
    assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>x<\/script>/);
    assert.doesNotMatch(html, /\/icons\//);
    assert.doesNotMatch(html, /<img\b/i);
  });
});
