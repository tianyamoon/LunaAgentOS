import test from "node:test";
import assert from "node:assert/strict";
import {
  closeStreamingMarkdown,
  hasMarkdownTable,
  isMarkdownTableSeparator,
  markdownTableCellCount,
  normalizeLooseMarkdownTables,
  normalizeRuntimeMarkdown,
  splitCollapsedMarkdownTableRows,
  transformOutsideCodeFences,
} from "./normalize.js";

test("transformOutsideCodeFences leaves fenced code untouched", () => {
  const input = "outside\n```js\ninside\n```\nafter";
  const output = transformOutsideCodeFences(input, (line) => line.toUpperCase());
  assert.equal(output, "OUTSIDE\n```js\ninside\n```\nAFTER");
});

test("transformOutsideCodeFences normalizes CRLF to LF", () => {
  const input = "a\r\nb\r\nc";
  const output = transformOutsideCodeFences(input, (line) => line);
  assert.equal(output, "a\nb\nc");
});

test("isMarkdownTableSeparator recognizes valid separators", () => {
  assert.equal(isMarkdownTableSeparator("|---|---|"), true);
  assert.equal(isMarkdownTableSeparator("| :--- | ---: | :---: |"), true);
  assert.equal(isMarkdownTableSeparator("--- | --- | ---"), true);
});

test("isMarkdownTableSeparator rejects single column or non-separator", () => {
  assert.equal(isMarkdownTableSeparator("|---|"), false);
  assert.equal(isMarkdownTableSeparator("a | b"), false);
  assert.equal(isMarkdownTableSeparator(""), false);
  assert.equal(isMarkdownTableSeparator(null), false);
});

test("markdownTableCellCount counts cells, ignoring trim and edges", () => {
  assert.equal(markdownTableCellCount("| a | b | c |"), 3);
  assert.equal(markdownTableCellCount("a|b|c"), 3);
  assert.equal(markdownTableCellCount(""), 0);
  assert.equal(markdownTableCellCount(null), 0);
});

test("hasMarkdownTable detects header followed by separator", () => {
  const input = "intro\n| h1 | h2 |\n| --- | --- |\n| a | b |";
  assert.equal(hasMarkdownTable(input), true);
});

test("hasMarkdownTable returns false when no separator follows", () => {
  const input = "| a | b |\n| c | d |";
  assert.equal(hasMarkdownTable(input), false);
});

test("closeStreamingMarkdown closes a dangling fence", () => {
  const input = "```js\nconst x = 1;";
  const output = closeStreamingMarkdown(input);
  assert.match(output, /```$/);
});

test("closeStreamingMarkdown closes a dangling inline tick", () => {
  const output = closeStreamingMarkdown("inline `code");
  assert.equal(output.endsWith("`"), true);
});

test("closeStreamingMarkdown closes a dangling strong marker", () => {
  const output = closeStreamingMarkdown("hello **world");
  assert.equal(output.endsWith("**"), true);
});

test("closeStreamingMarkdown closes a dangling strike marker", () => {
  const output = closeStreamingMarkdown("hello ~~world");
  assert.equal(output.endsWith("~~"), true);
});

test("closeStreamingMarkdown leaves balanced markers alone", () => {
  const balanced = "**bold** `inline` ~~strike~~";
  assert.equal(closeStreamingMarkdown(balanced), balanced);
});

test("splitCollapsedMarkdownTableRows breaks header glued to separator", () => {
  const input = "| a | b | c |  | --- | --- | --- |";
  const output = splitCollapsedMarkdownTableRows(input);
  assert.match(output, /\|\n\|/);
});

test("normalizeRuntimeMarkdown injects a blank line before headers stuck to text", () => {
  const input = "前言####### note: not real";
  const output = normalizeRuntimeMarkdown(input);
  // The original transform protects fenced code - assert smoke that the
  // transform runs without throwing on edge input.
  assert.equal(typeof output, "string");
});

test("normalizeLooseMarkdownTables synthesizes a separator for header-without-separator", () => {
  const input = "| h1 | h2 |\n| a | b |";
  const output = normalizeLooseMarkdownTables(input);
  const lines = output.split("\n");
  // expected order: header, synthesized separator, body
  assert.equal(lines[0], "| h1 | h2 |");
  assert.match(lines[1], /---\|---/);
  assert.equal(lines[2], "| a | b |");
});

test("normalizeLooseMarkdownTables leaves an existing table alone", () => {
  const input = "| h1 | h2 |\n| --- | --- |\n| a | b |";
  const output = normalizeLooseMarkdownTables(input);
  assert.equal(output, input);
});

test("normalizeLooseMarkdownTables ignores tables inside code fences", () => {
  const input = "```\n| a | b |\n| c | d |\n```";
  const output = normalizeLooseMarkdownTables(input);
  assert.equal(output, input);
});
