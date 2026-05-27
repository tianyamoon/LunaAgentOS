import test from "node:test";
import assert from "node:assert/strict";
import { renderTurnEventItemHtml, renderTurnEventsHtml } from "./turnEventsView.js";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const translate = (key) => key;

test("renderTurnEventsHtml returns empty string for missing input", () => {
  assert.equal(renderTurnEventsHtml(null, { translate, escapeHtml }), "");
  assert.equal(renderTurnEventsHtml([], { translate, escapeHtml }), "");
});

test("renderTurnEventItemHtml renders a no-detail node as a single row", () => {
  const html = renderTurnEventItemHtml(
    { id: "t1:plan", kind: "plan", status: "info", title: "Plan refreshed" },
    { translate, escapeHtml },
  );
  assert.match(html, /class="turn-event[^"]*"/);
  assert.match(html, /turn-event-kind-plan/);
  assert.match(html, /turn-event-status-info/);
  assert.match(html, /no-detail/);
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /Plan refreshed/);
});

test("renderTurnEventItemHtml renders details when detail text exists", () => {
  const html = renderTurnEventItemHtml(
    { id: "t1:tool:0", kind: "tool", status: "done", title: "Search", detail: "results=3" },
    { translate, escapeHtml },
  );
  assert.match(html, /<details[^>]*data-detail-key="t1:tool:0"/);
  assert.match(html, /Search/);
  assert.match(html, /results=3/);
});

test("renderTurnEventItemHtml opens running events by default", () => {
  const html = renderTurnEventItemHtml(
    { id: "t1:thinking", kind: "thinking", status: "running", title: "Thinking", detail: "thoughts" },
    { translate, escapeHtml },
  );
  assert.match(html, /<details[^>]*open/);
});

test("renderTurnEventItemHtml respects isOpenForKey override", () => {
  const html = renderTurnEventItemHtml(
    { id: "t1:thinking", kind: "thinking", status: "done", title: "Thinking", detail: "thoughts" },
    { translate, escapeHtml, isOpenForKey: (key) => key === "t1:thinking" },
  );
  assert.match(html, /<details[^>]*open/);
});

test("renderTurnEventItemHtml escapes detail content", () => {
  const html = renderTurnEventItemHtml(
    { id: "t1", kind: "log", status: "info", title: "<i>title</i>", detail: "<script>" },
    { translate, escapeHtml },
  );
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
