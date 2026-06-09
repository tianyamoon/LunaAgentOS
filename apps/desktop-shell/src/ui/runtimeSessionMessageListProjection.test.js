import assert from "node:assert/strict";
import test from "node:test";

import { projectRuntimeSessionMessageList } from "./runtimeSessionMessageListProjection.js";

test("runtimeSessionMessageListProjection: 运行中按真实 Timeline 顺序输出连续消息", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-1",
    turns: [{
      id: "t1",
      task: "检查项目",
      status: "running",
      promptRunId: "run-1",
      timelineItems: [
        item("thinking", "先看结构"),
        item("tool", "Read", { id: "tool-1", metadata: { category: "explore" } }),
        item("assistant", "找到入口"),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "thinking", "tool", "assistant"]);
  assert.equal(result.scrollTargetRowId, "t1:user");
  assert.equal(result.rows.every((row) => row.turnId === "t1"), true);
  assert.equal(result.rows[1].promptRunId, "run-1");
});

test("runtimeSessionMessageListProjection: 只聚合相邻 explore 工具且不跨越 Thinking", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "读文件",
      status: "running",
      timelineItems: [
        item("tool", "Read A", { id: "read-a", metadata: { category: "explore" } }),
        item("tool", "Read B", { id: "read-b", metadata: { category: "explore" } }),
        item("thinking", "判断"),
        item("tool", "Read C", { id: "read-c", metadata: { category: "explore" } }),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "tool_group", "thinking", "tool"]);
  assert.deepEqual(result.rows[1].metadata.items.map((row) => row.id), ["t1:timeline:read-a", "t1:timeline:read-b"]);
});

test("runtimeSessionMessageListProjection: 完成态最终回答为主体并生成 Worked 行", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "summarize",
      status: "completed",
      finalResponse: "done summary",
      timelineStartedAt: "2026-06-01T00:00:00.000Z",
      timelineCompletedAt: "2026-06-01T00:00:05.000Z",
      timelineItems: [
        item("thinking", "analyze"),
        item("tool", "Read", { id: "read-1" }),
        item("assistant", "done summary"),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "assistant", "worked_for"]);
  assert.equal(result.rows[1].content, "done summary");
  assert.equal(result.rows[1].metadata.final, true);
  assert.equal(result.rows[2].metadata.summary.durationMs, 5000);
  assert.deepEqual(result.rows[2].metadata.rows.map((row) => row.kind), ["thinking", "tool"]);
  assert.deepEqual(result.rows[2].metadata.rows.map((row) => row.metadata.turnCompleted), [true, true]);
});

test("runtimeSessionMessageListProjection: completed trace rows use completion scoped keys", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "summarize",
      status: "completed",
      finalResponse: "done summary",
      timelineStartedAt: "2026-06-01T00:00:00.000Z",
      timelineCompletedAt: "2026-06-01T00:00:05.000Z",
      timelineItems: [
        item("thinking", "analyze"),
        item("tool", "Read", { id: "read-1" }),
        item("assistant", "done summary"),
      ],
    }],
  });

  const worked = result.rows.at(-1);
  const traceRows = worked.metadata.rows;
  assert.equal(worked.metadata.detailKey, "t1:completed:2026-06-01T00:00:05.000Z:worked-for");
  assert.deepEqual(traceRows.map((row) => row.id), [
    "t1:completed-timeline:thinking-analyze",
    "t1:completed-timeline:read-1",
  ]);
  assert.equal(traceRows[1].metadata.detailKey, "t1:completed:2026-06-01T00:00:05.000Z:completed-timeline:read-1:message");
  assert.equal(traceRows.some((row) => row.id === "t1:timeline:read-1"), false);
});

test("runtimeSessionMessageListProjection: debug metadata is folded under completed summary", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "failed task",
      status: "failed",
      logs: ["tool failed"],
      timelineItems: [
        item("tool", "Terminal", {
          id: "tool-1",
          status: "failed",
          metadata: { rawEvent: { type: "tool", payload: { id: "tool-1" } } },
        }),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "worked_for"]);
  const debug = result.rows.at(-1).metadata.debug;
  assert.equal(debug.rawEvents.length, 1);
  assert.deepEqual(debug.logs, ["tool failed"]);
});

test("runtimeSessionMessageListProjection: completed turn folds even when prompt run id is stale", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-stale",
    turns: [{
      id: "t1",
      task: "done task",
      status: "completed",
      promptRunId: "run-stale",
      finalResponse: "final answer",
      timelineItems: [
        item("thinking", "analysis"),
        item("tool", "Read", { id: "read-1" }),
        item("assistant", "final answer"),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "assistant", "worked_for"]);
  assert.deepEqual(result.rows.at(-1).metadata.rows.map((row) => row.kind), ["thinking", "tool"]);
});

test("runtimeSessionMessageListProjection: stale activeTurnId does not keep old running turn live", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-stale",
    turns: [
      {
        id: "t1",
        task: "old task",
        status: "running",
        promptRunId: "run-stale",
        timelineItems: [item("thinking", "old analysis", { status: "running" })],
      },
      {
        id: "t2",
        task: "done task",
        status: "completed",
        finalResponse: "final answer",
        timelineItems: [item("assistant", "final answer")],
      },
    ],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "worked_for", "user", "assistant"]);
  assert.equal(result.rows.some((row) => row.status === "running"), false);
  assert.equal(result.latestTurnId, "t2");
});

test("runtimeSessionMessageListProjection: completed trace rows drop stale running status", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "done task",
      status: "completed",
      finalResponse: "final answer",
      timelineItems: [
        item("thinking", "analysis", { status: "running" }),
        item("tool", "Read", { id: "read-1", status: "running" }),
        item("assistant", "final answer"),
      ],
    }],
  });

  const traceRows = result.rows.at(-1).metadata.rows;
  assert.deepEqual(traceRows.map((row) => row.status), ["completed", "completed"]);
});

test("runtimeSessionMessageListProjection: failed turn keeps process rows folded under worked row", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "failing task",
      status: "failed",
      timelineItems: [
        item("thinking", "analysis"),
        item("tool", "Run command", { id: "tool-1", status: "failed" }),
        item("error", "command failed", { id: "error-1", status: "failed" }),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "worked_for"]);
  assert.equal(result.rows.at(-1).status, "failed");
  assert.deepEqual(result.rows.at(-1).metadata.rows.map((row) => row.kind), ["thinking", "tool", "error"]);
});

test("runtimeSessionMessageListProjection: cancelled turn keeps final response primary and folds process", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "cancel task",
      status: "cancelled",
      finalResponse: "cancelled after partial work",
      timelineItems: [
        item("thinking", "analysis"),
        item("tool", "Read", { id: "read-1" }),
        item("assistant", "cancelled after partial work"),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "assistant", "worked_for"]);
  assert.equal(result.rows[1].content, "cancelled after partial work");
  assert.equal(result.rows.at(-1).status, "cancelled");
  assert.deepEqual(result.rows.at(-1).metadata.rows.map((row) => row.kind), ["thinking", "tool"]);
});

test("runtimeSessionMessageListProjection: 旧历史与队列使用独立消息行", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "旧问题",
      status: "completed",
      finalResponse: "旧回答",
      meta: { historyIntegrity: "legacy_unverified" },
    }],
    queuedSubmissions: [{
      id: "q1",
      task: "后续输入",
      attachments: [{ name: "a.md" }],
      createdAt: "2026-06-01T00:00:00.000Z",
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["legacy_warning", "user", "assistant", "queue"]);
  assert.equal(result.rows.at(-1).metadata.attachmentCount, 1);
});

test("runtimeSessionMessageListProjection: usage 不进入默认阅读流", () => {
  const result = projectRuntimeSessionMessageList({
    turns: [{
      id: "t1",
      task: "检查用量",
      status: "running",
      timelineItems: [
        item("usage", ""),
        item("assistant", "继续"),
      ],
    }],
  });

  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "assistant"]);
});

test("runtimeSessionMessageListProjection: latest-only 只保留当前消息段", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t2",
    turns: [
      { id: "t1", task: "旧问题", status: "completed", finalResponse: "旧回答" },
      { id: "t2", task: "新问题", status: "running", timelineItems: [item("thinking", "处理中")] },
    ],
  }, { latestOnly: true });

  assert.equal(result.rows.some((row) => row.turnId === "t1"), false);
  assert.equal(result.rows.some((row) => row.turnId === "t2"), true);
});

test("runtimeSessionMessageListProjection: running runtime logs hide low-value acknowledgements", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-1",
    turns: [{
      id: "t1",
      task: "show progress",
      status: "running",
      promptRunId: "run-1",
      logs: ["Reading config", "tool call completed", "Message entered current session, waiting for runtime response."],
      timelineItems: [],
    }],
  });

  const runtimeRows = result.rows.filter((row) => row.kind === "runtime");
  assert.deepEqual(runtimeRows.map((row) => row.content), ["Reading config"]);
});

test("runtimeSessionMessageListProjection: waiting acknowledgement stays visible while no process row exists", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-1",
    turns: [{
      id: "t1",
      task: "wait for feedback",
      status: "running",
      promptRunId: "run-1",
      logs: ["tool call completed", "Message entered current session, waiting for runtime response."],
      timelineItems: [],
    }],
  });

  const runtimeRows = result.rows.filter((row) => row.kind === "runtime");
  assert.deepEqual(runtimeRows.map((row) => row.content), ["Message entered current session, waiting for runtime response."]);
});

test("runtimeSessionMessageListProjection: waiting acknowledgement hides after thinking starts", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-1",
    turns: [{
      id: "t1",
      task: "think",
      status: "running",
      promptRunId: "run-1",
      logs: ["Message entered current session, waiting for runtime response."],
      timelineItems: [item("thinking", "Analyzing request", { status: "running" })],
    }],
  });

  const runtimeRows = result.rows.filter((row) => row.kind === "runtime");
  assert.deepEqual(runtimeRows.map((row) => row.content), []);
  assert.equal(result.rows.some((row) => row.kind === "thinking"), true);
});

test("runtimeSessionMessageListProjection: 只读历史不展示运行中的等待日志", () => {
  const result = projectRuntimeSessionMessageList({
    access_mode: "read_only",
    activeTurnId: "t1",
    turns: [{
      id: "t1",
      task: "旧历史",
      status: "running",
      logs: ["Message entered current session, waiting for runtime response."],
      timelineItems: [],
    }],
  });

  assert.equal(result.rows.some((row) => row.kind === "runtime"), false);
  assert.deepEqual(result.rows.map((row) => row.kind), ["user", "worked_for"]);
});

test("runtimeSessionMessageListProjection: running runtime logs keep blocking or error signals visible", () => {
  const result = projectRuntimeSessionMessageList({
    activeTurnId: "t1",
    activePromptRunId: "run-1",
    turns: [{
      id: "t1",
      task: "check runtime",
      status: "running",
      promptRunId: "run-1",
      logs: ["tool call completed", "Permission denied", "Message entered current session, waiting for runtime response."],
      timelineItems: [],
    }],
  });

  const runtimeRows = result.rows.filter((row) => row.kind === "runtime");
  assert.deepEqual(runtimeRows.map((row) => row.content), ["Permission denied"]);
});

test("runtimeSessionMessageListProjection: reconnecting session without turns renders a visible runtime row", () => {
  const result = projectRuntimeSessionMessageList({
    id: "s-restore",
    turns: [],
    runtime_binding: {
      state: "reconnecting",
      stage: "load",
    },
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].kind, "runtime");
  assert.equal(result.rows[0].status, "running");
  assert.equal(result.rows[0].metadata.stage, "load");
  assert.equal(result.scrollTargetRowId, "s-restore:runtime:load");
});

function item(type, content, overrides = {}) {
  return {
    id: overrides.id || `${type}-${content}`,
    type,
    status: overrides.status || "completed",
    content,
    metadata: overrides.metadata || {},
  };
}
