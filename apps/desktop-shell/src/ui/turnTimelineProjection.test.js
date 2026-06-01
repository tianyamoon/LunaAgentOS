import assert from "node:assert/strict";
import test from "node:test";

import {
  groupAdjacentExploreTools,
  projectCompletedTimelineSummary,
  projectLegacyTimeline,
  projectLiveTimeline,
} from "./turnTimelineProjection.js";

test("groupAdjacentExploreTools: 只聚合连续 explore Tool，不跨越 Thinking", () => {
  const items = [
    tool("read-1", "explore"),
    tool("read-2", "explore"),
    item("thinking", "思考"),
    tool("read-3", "explore"),
    tool("edit-1", "edit"),
  ];

  const groups = groupAdjacentExploreTools(items);

  assert.deepEqual(groups.map((entry) => entry.type), ["tool_group", "thinking", "tool", "tool"]);
  assert.deepEqual(groups[0].items.map((entry) => entry.id), ["read-1", "read-2"]);
});

test("projectLiveTimeline: 有序 Timeline 保持 Assistant 与 Tool 的交叉关系", () => {
  const turn = {
    timelineItems: [
      item("assistant", "先检查"),
      tool("read-1", "explore"),
      item("assistant", "再修改"),
    ],
  };

  assert.deepEqual(projectLiveTimeline(turn).map((entry) => entry.type), ["assistant", "tool", "assistant"]);
});

test("projectCompletedTimelineSummary: 完成摘要统计时长、工具和文件变更", () => {
  const turn = {
    timelineStartedAt: "2026-06-01T00:00:00.000Z",
    timelineCompletedAt: "2026-06-01T00:10:42.000Z",
    timelineItems: [
      tool("read-1", "explore"),
      tool("edit-1", "edit"),
      item("file_change", "src/main.js"),
      item("assistant", "完成"),
    ],
  };

  assert.deepEqual(projectCompletedTimelineSummary(turn), {
    durationMs: 642000,
    toolCount: 2,
    fileChangeCount: 1,
    legacyApproximation: false,
  });
});

test("projectLegacyTimeline: 旧历史近似重建但不修改原 Turn", () => {
  const turn = {
    thoughts: ["检查"],
    logs: ["日志"],
    finalResponse: "完成",
    createdAt: "2026-06-01T00:00:00.000Z",
  };

  const projected = projectLegacyTimeline(turn);

  assert.deepEqual(projected.map((entry) => entry.type), ["thinking", "runtime", "assistant"]);
  assert.equal(projected.every((entry) => entry.metadata.legacyApproximation), true);
  assert.equal(turn.timelineItems, undefined);
});

function item(type, content) {
  return {
    id: `${type}-${content}`,
    type,
    status: "completed",
    content,
    metadata: {},
  };
}

function tool(id, category) {
  return {
    ...item("tool", id),
    id,
    metadata: { category },
  };
}
