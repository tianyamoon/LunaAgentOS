import assert from "node:assert/strict";
import test from "node:test";

import { createTurnTimelineView, formatTimelineDuration } from "./turnTimelineView.js";

test("formatTimelineDuration: Worked for 使用紧凑时长", () => {
  assert.equal(formatTimelineDuration(642000), "10m 42s");
  assert.equal(formatTimelineDuration(3723000), "1h 2m 3s");
});

test("turnTimelineView: 运行中保持 Assistant、Tool 与 Thinking 的交叉顺序", () => {
  const html = view().renderTurnTimeline({
    id: "turn-1",
    timelineItems: [
      item("thinking", "先定位"),
      item("tool", "读取文件"),
      item("assistant", "继续检查"),
    ],
  }, { streaming: true });

  assert.ok(html.indexOf("先定位") < html.indexOf("读取文件"));
  assert.ok(html.indexOf("读取文件") < html.indexOf("继续检查"));
  assert.match(html, /turn-timeline is-live/);
});

test("turnTimelineView: 完成态以最终回答为主体并把过程收敛到 Worked for", () => {
  const html = view().renderTurnTimeline({
    id: "turn-2",
    finalResponse: "最终结论",
    timelineStartedAt: "2026-06-01T00:00:00.000Z",
    timelineCompletedAt: "2026-06-01T00:10:42.000Z",
    timelineItems: [
      item("thinking", "先定位"),
      item("tool", "读取文件"),
      item("assistant", "最终结论"),
    ],
  }, { responseText: "最终结论", rawResponseText: "最终结论" });

  assert.match(html, /Worked for 10m 42s/);
  assert.equal(html.match(/最终结论/g)?.length, 1);
  assert.doesNotMatch(html, /data-detail-key="turn-2:timeline" open/);
});

test("turnTimelineView: 旧历史过程会明确标记为近似摘要", () => {
  const html = view().renderTurnTimeline({
    id: "turn-3",
    createdAt: "2026-06-01T00:00:00.000Z",
    finalResponse: "完成",
    thoughts: ["检查"],
    logs: ["运行日志"],
  }, { responseText: "完成", rawResponseText: "完成" });

  assert.match(html, /历史过程摘要/);
});

function view() {
  return createTurnTimelineView({
    renderAssistantResponse: (content) => `<div class="rendered">${content}</div>`,
    isOpenForKey: (_key, defaultOpen) => defaultOpen,
    t: translate,
    escapeHtml: (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
  });
}

function translate(key, params = {}) {
  const dictionary = {
    "turn.waiting": "等待响应...",
    "turn.timeline.assistant": "Assistant",
    "turn.timeline.emptyEvent": "事件",
    "turn.timeline.exploreTools": `读取 ${params.count} 个文件`,
    "turn.timeline.legacyApproximation": "历史过程摘要 · 顺序为近似重建",
    "turn.timeline.toolCount": ` · ${params.count} tools`,
    "turn.timeline.fileCount": ` · ${params.count} files changed`,
    "turn.timeline.workedFor": `Worked for ${params.duration}${params.tools}${params.files}`,
  };
  return dictionary[key] || key;
}

function item(type, content) {
  return {
    id: `${type}-${content}`,
    type,
    status: "completed",
    content,
    metadata: {},
  };
}
