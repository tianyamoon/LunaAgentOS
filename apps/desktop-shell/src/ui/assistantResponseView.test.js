import test from "node:test";
import assert from "node:assert/strict";
import { renderAssistantResponse, splitAssistantResponseForDisplay } from "./assistantResponseView.js";

const dependencies = {
  closeStreamingMarkdown: (text) => `${text}[closed]`,
  escapeHtml: (text) => String(text).replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
  renderRichText: (text) => `<markdown>${text}</markdown>`,
  t: (key) => key,
};

test("renderAssistantResponse: long lines still render Markdown by default", () => {
  const longLine = `**summary** ${"detail ".repeat(40)}`;
  const html = renderAssistantResponse(longLine, "final", dependencies);
  assert.match(html, /<markdown>/);
  assert.match(html, /response-source-detail/);
  assert.doesNotMatch(html, /plain-report-view/);
});

test("renderAssistantResponse: table-like content still renders Markdown by default", () => {
  const html = renderAssistantResponse("| a | b | c |\n|---|---|---|\n| 1 | 2 | 3 |", "final", dependencies);
  assert.match(html, /<markdown>/);
  assert.match(html, /response-source-detail/);
});

test("renderAssistantResponse: raw source is an explicit secondary detail", () => {
  const html = renderAssistantResponse("hello", "final", dependencies);
  assert.match(html, /<details class="response-source-detail">/);
  assert.match(html, /<summary>report.rawView<\/summary>/);
  assert.match(html, /<pre>hello<\/pre>/);
});

test("renderAssistantResponse: streaming markdown is closed before render", () => {
  const html = renderAssistantResponse("hello", "streaming", dependencies);
  assert.match(html, /<markdown>hello\[closed\]<\/markdown>/);
});

test("splitAssistantResponseForDisplay: folds process prelude before a report part", () => {
  const source = `${"我需要先检查现有数据。".repeat(14)}\n\n## Part 1 报告\n结果`;
  assert.deepEqual(splitAssistantResponseForDisplay(source), {
    prelude: "我需要先检查现有数据。".repeat(14),
    body: "## Part 1 报告\n结果",
  });
});
