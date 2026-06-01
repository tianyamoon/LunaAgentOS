import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTurnTimelineEvent,
  finalizeTurnTimeline,
  reconstructLegacyTurnTimeline,
} from "./turnTimeline.js";

test("appendTurnTimelineEvent: Tool 打断 Assistant 后保留真实执行顺序", () => {
  const turn = {};
  let clock = 1000;
  const now = () => ++clock;

  appendTurnTimelineEvent(turn, { type: "response", payload: { content: "先检查" } }, { now });
  appendTurnTimelineEvent(turn, { type: "tool", payload: { title: "读取文件", status: "completed" } }, { now });
  appendTurnTimelineEvent(turn, { type: "response", payload: { content: "，再修改" } }, { now });

  assert.deepEqual(
    turn.timelineItems.map((item) => ({ type: item.type, content: item.content })),
    [
      { type: "assistant", content: "先检查" },
      { type: "tool", content: "读取文件" },
      { type: "assistant", content: "，再修改" },
    ],
  );
});

test("appendTurnTimelineEvent: 相邻 Thought 与 Assistant delta 各自在当前片段中合并", () => {
  const turn = {};
  const now = () => 1000;

  appendTurnTimelineEvent(turn, { type: "thought", payload: { content: "检查" } }, { now });
  appendTurnTimelineEvent(turn, { type: "thought", payload: { content: "入口" } }, { now });
  appendTurnTimelineEvent(turn, { type: "response", payload: { content: "结论" } }, { now });
  appendTurnTimelineEvent(turn, { type: "response", payload: { content: "如下" } }, { now });

  assert.deepEqual(
    turn.timelineItems.map((item) => ({ type: item.type, content: item.content })),
    [
      { type: "thinking", content: "检查入口" },
      { type: "assistant", content: "结论如下" },
    ],
  );
});

test("appendTurnTimelineEvent: Permission 与 File Changes 保留原地顺序", () => {
  const turn = {};
  const now = () => 1000;

  appendTurnTimelineEvent(turn, { type: "thought", payload: { content: "准备修改" } }, { now });
  appendTurnTimelineEvent(turn, { type: "permission", payload: { title: "允许修改文件？" } }, { now });
  appendTurnTimelineEvent(turn, { type: "file_change", payload: { content: "src/main.js +2 -1" } }, { now });

  assert.deepEqual(turn.timelineItems.map((item) => item.type), ["thinking", "permission", "file_change"]);
  assert.equal(turn.timelineItems[1].status, "waiting");
});

test("finalizeTurnTimeline: 完成 Turn 后关闭 active item 并记录完成时间", () => {
  const turn = {};
  const now = () => 1000;

  appendTurnTimelineEvent(turn, { type: "response", payload: { content: "完成" } }, { now });
  finalizeTurnTimeline(turn, { now });

  assert.equal(turn.activeTimelineItemId, null);
  assert.equal(turn.timelineItems[0].status, "completed");
  assert.equal(turn.timelineCompletedAt, "1970-01-01T00:00:01.000Z");
});

test("reconstructLegacyTurnTimeline: 旧历史生成带近似标记的可读 Timeline", () => {
  const turn = {
    createdAt: "2026-05-29T12:00:00.000Z",
    thoughts: ["先检查"],
    logs: ["后发生", "先发生"],
    outputs: ["旧输出"],
    finalResponse: "最终回答",
  };

  reconstructLegacyTurnTimeline(turn, { now: () => 1000 });

  assert.deepEqual(turn.timelineItems.map((item) => item.type), ["thinking", "runtime", "runtime", "assistant"]);
  assert.deepEqual(turn.timelineItems.map((item) => item.content), ["先检查", "先发生", "后发生", "最终回答"]);
  assert.equal(turn.timelineItems.every((item) => item.metadata.legacyApproximation), true);
  assert.equal(turn.timelineCompletedAt, "2026-05-29T12:00:00.000Z");
});
