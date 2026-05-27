import test from "node:test";
import assert from "node:assert/strict";
import {
  isStreamingTurnState,
  turnEventCounts,
  turnEventsFromTurn,
  turnHasRunningEvent,
} from "./turnEvents.js";

const translateZh = (key, params = {}) => {
  const dict = {
    "event.toolCall": "工具调用",
    "event.statusSeparator": "：",
    "event.planUpdated": "运行时更新了执行计划。",
    "event.planUpdatedWithDetails": "运行时更新了执行计划：",
    "event.usageUpdated": `用量更新：${params.parts ?? ""}`,
    "turn.events.thinkingRunning": "思考中...",
    "turn.events.thinkingDone": "思考完成",
    "turn.events.errorTitle": "运行时错误",
  };
  return dict[key] ?? key;
};

test("isStreamingTurnState marks pre-final states as streaming", () => {
  assert.equal(isStreamingTurnState(0), true);
  assert.equal(isStreamingTurnState(2), true);
  assert.equal(isStreamingTurnState(3), true);
  assert.equal(isStreamingTurnState(5), false);
  assert.equal(isStreamingTurnState(9), false);
});

test("turnEventsFromTurn collapses thoughts into a single thinking node", () => {
  const turn = {
    id: "t1",
    state: 2,
    thoughts: ["plan first", "then tool"],
    logs: [],
    outputs: [],
    finalResponse: "",
  };
  const events = turnEventsFromTurn(turn, { translate: translateZh });
  assert.equal(events.length, 1);
  assert.deepEqual(
    { kind: events[0].kind, status: events[0].status, title: events[0].title },
    { kind: "thinking", status: "running", title: "思考中..." },
  );
  assert.equal(events[0].detail, "plan first\n\nthen tool");
});

test("turnEventsFromTurn marks thinking done once a final response exists", () => {
  const turn = {
    id: "t2",
    state: 5,
    thoughts: ["a"],
    logs: [],
    outputs: ["done"],
    finalResponse: "done",
  };
  const [thinking] = turnEventsFromTurn(turn, { translate: translateZh });
  assert.equal(thinking.status, "done");
  assert.equal(thinking.title, "思考完成");
});

test("turnEventsFromTurn classifies tool/plan/usage logs into structured nodes", () => {
  const turn = {
    id: "t3",
    state: 5,
    thoughts: [],
    logs: [
      "用量更新：输入 12 · 总计 24",
      "运行时更新了执行计划：\n[completed] 步骤 1",
      "Search：done",
    ],
    outputs: [],
    finalResponse: "ok",
  };
  const events = turnEventsFromTurn(turn, { translate: translateZh });
  // logs 是 prepend 的，所以倒序后第一个事件是最早的 "Search：done"
  assert.deepEqual(events.map((event) => event.kind), ["tool", "plan", "usage"]);
  assert.equal(events[0].title, "Search");
  assert.equal(events[0].status, "done");
  assert.equal(events[0].detail, "done");
  assert.equal(events[1].title, "运行时更新了执行计划。");
  assert.equal(events[1].detail, "[completed] 步骤 1");
  assert.equal(events[2].title, "用量更新：输入 12 · 总计 24");
});

test("turnEventsFromTurn surfaces runtime error state as a dedicated event", () => {
  const turn = {
    id: "t4",
    state: 9,
    thoughts: [],
    logs: ["resume failed: timeout"],
    outputs: [],
    finalResponse: "",
  };
  const events = turnEventsFromTurn(turn, { translate: translateZh });
  // log 行被分类为 generic log，再补一个错误节点
  assert.equal(events.at(-1).kind, "error");
  assert.equal(events.at(-1).status, "error");
  assert.equal(events.at(-1).title, "运行时错误");
  assert.equal(events.at(-1).detail, "resume failed: timeout");
});

test("turnEventsFromTurn falls back to generic log for unstructured lines", () => {
  const turn = {
    id: "t5",
    state: 5,
    thoughts: [],
    logs: ["Hermes profile foo 正在启动 MCP..."],
    outputs: [],
    finalResponse: "ok",
  };
  const [event] = turnEventsFromTurn(turn, { translate: translateZh });
  assert.equal(event.kind, "log");
  assert.equal(event.status, "info");
  assert.equal(event.title, "Hermes profile foo 正在启动 MCP...");
  assert.equal(event.detail, undefined);
});

test("turnEventCounts and turnHasRunningEvent summarize the event list", () => {
  const events = [
    { kind: "thinking", status: "running" },
    { kind: "tool", status: "done" },
    { kind: "log", status: "info" },
  ];
  assert.deepEqual(turnEventCounts(events), {
    thinking: 1, tool: 1, plan: 0, usage: 0, state: 0, log: 1, error: 0,
  });
  assert.equal(turnHasRunningEvent(events), true);
  assert.equal(turnHasRunningEvent(events.slice(1)), false);
});
