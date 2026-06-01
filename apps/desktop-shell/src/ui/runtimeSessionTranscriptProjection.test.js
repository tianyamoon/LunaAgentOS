import test from "node:test";
import assert from "node:assert/strict";
import { projectRuntimeSessionTranscript } from "./runtimeSessionTranscriptProjection.js";

function project(session) {
  return projectRuntimeSessionTranscript(session, {
    resolveStatusView: () => ({ status: "running", label: "运行中" }),
    translate: (key) => key,
  });
}

test("runtimeSessionTranscriptProjection: 最新 Turn 与历史 Turn 分层投影", () => {
  const result = project({
    turns: [
      { id: "t1", task: "旧问题", finalResponse: "旧回答", status: "completed" },
      { id: "t2", task: "新问题", finalResponse: "", status: "running" },
    ],
  });

  assert.equal(result.latestTurn.id, "t2");
  assert.equal(result.previousTurns.length, 1);
  assert.equal(result.previousTurns[0].summary, "旧回答");
});

test("runtimeSessionTranscriptProjection: follow-up 队列只暴露紧凑输入摘要", () => {
  const result = project({
    turns: [],
    queuedSubmissions: [{
      id: "q1",
      task: "稍后继续",
      runtimePrompt: "很长的附件正文",
      attachments: [{ name: "a.md" }, { name: "b.md" }],
    }],
  });

  assert.deepEqual(result.queuedSubmissions, [{
    id: "q1",
    task: "稍后继续",
    attachmentCount: 2,
    createdAt: null,
  }]);
});

test("runtimeSessionTranscriptProjection: active Prompt Run 决定滚动投影语义", () => {
  assert.equal(project({ turns: [], activePromptRunId: "run-1" }).scrollMode, "following_active_run");
  assert.equal(project({ turns: [] }).scrollMode, "stable");
});

test("runtimeSessionTranscriptProjection: Card 状态沿用统一状态模块", () => {
  const result = project({ turns: [] });
  assert.deepEqual(result.header.cardStatus, { status: "running", label: "运行中" });
  assert.equal(result.cardStatus, result.header.cardStatus);
});

