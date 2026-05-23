import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, safeLinkHref } from "./escape.js";

test("escapeHtml escapes the canonical five HTML entities", () => {
  const input = `<>&"'`;
  assert.equal(escapeHtml(input), "&lt;&gt;&amp;&quot;&#39;");
});

test("escapeHtml stringifies null and undefined to empty", () => {
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("escapeHtml does not escape non-special characters", () => {
  assert.equal(escapeHtml("hello world 你好"), "hello world 你好");
});

test("safeLinkHref allows http and https urls", () => {
  assert.equal(safeLinkHref("http://example.com"), "http://example.com");
  assert.equal(safeLinkHref("https://example.com/foo?bar=1"), "https://example.com/foo?bar=1");
});

test("safeLinkHref allows mailto and file", () => {
  assert.equal(safeLinkHref("mailto:user@example.com"), "mailto:user@example.com");
  assert.equal(safeLinkHref("file:///tmp/x"), "file:///tmp/x");
});

test("safeLinkHref blocks javascript: and data: urls", () => {
  assert.equal(safeLinkHref("javascript:alert(1)"), "");
  assert.equal(safeLinkHref("data:text/html,<script>"), "");
});

test("safeLinkHref escapes embedded HTML special chars in safe urls", () => {
  assert.equal(safeLinkHref("https://example.com?<x>"), "https://example.com?&lt;x&gt;");
});
