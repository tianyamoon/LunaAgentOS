import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeSessionTranscriptView } from "./runtimeSessionTranscriptView.js";

function makeView({ collapsed = () => false } = {}) {
  return createRuntimeSessionTranscriptView({
    turnTimelineView: { renderTurnTimeline: () => "<div>timeline</div>" },
    isTurnCollapsed: collapsed,
    clearTurnDetailOpenState() {},
    turnResponseText: (turn) => turn.finalResponse || "",
    statusFromRuntimeStateCode: () => "completed",
    isRunningTurnStatus: (status) => status === "running",
    turnStatusClasses: { completed: "done", running: "busy" },
    turnStatusLabel: (status) => status,
    renderTurnCollapseIcon: () => "<svg></svg>",
    TURN_STATUS: { failed: "failed" },
    t: (key, values = {}) => values.count == null ? key : `${key}:${values.count}`,
    escapeHtml: (value) => String(value ?? ""),
  });
}

test("runtimeSessionTranscriptView: 最新轮展开且历史轮默认折叠", () => {
  const defaults = [];
  const view = makeView({ collapsed: (_id, defaultValue) => {
    defaults.push(defaultValue);
    return defaultValue;
  } });
  const html = view.renderTranscript({
    previousTurns: [{ index: 0, turn: { id: "t1", task: "旧问题", finalResponse: "旧回答", status: "completed" } }],
    latestTurn: { id: "t2", task: "新问题", finalResponse: "新回答", status: "completed" },
    queuedSubmissions: [],
  });

  assert.deepEqual(defaults, [true, false]);
  assert.match(html, /turn-block is-collapsed/);
  assert.match(html, /新问题/);
});

test("runtimeSessionTranscriptView: 本轮附件显示名称与嵌入状态", () => {
  const view = makeView();
  const html = view.renderTurn({
    id: "t1",
    task: "检查附件",
    status: "completed",
    meta: {
      attachments: [
        { name: "notes.md", status: "ready" },
        { name: "diagram.png", status: "error" },
      ],
    },
  }, 0);

  assert.match(html, /turn-attachment-strip/);
  assert.match(html, /notes\.md/);
  assert.match(html, /diagram\.png/);
  assert.match(html, /turn\.attachment\.ready/);
  assert.match(html, /turn\.attachment\.error/);
});

test("runtimeSessionTranscriptView: 排队输入独立展示附件数量", () => {
  const view = makeView();
  const html = view.renderTranscript({
    previousTurns: [],
    latestTurn: null,
    queuedSubmissions: [{ id: "q1", task: "稍后继续", attachmentCount: 2 }],
  });

  assert.match(html, /session-follow-up-queue/);
  assert.match(html, /稍后继续/);
  assert.match(html, /session\.followUpAttachmentCount:2/);
});

test("runtimeSessionTranscriptView: latest-only 隐藏历史轮但保留最新轮", () => {
  const view = makeView();
  const html = view.renderTranscript({
    previousTurns: [{ index: 0, turn: { id: "t1", task: "旧问题", status: "completed" } }],
    latestTurn: { id: "t2", task: "新问题", status: "completed" },
    queuedSubmissions: [],
  }, { latestOnly: true });

  assert.doesNotMatch(html, /旧问题/);
  assert.match(html, /新问题/);
  assert.match(html, /session\.hiddenTurns:1/);
});

test("runtimeSessionTranscriptView: 空 Session 保留暂无消息提示", () => {
  const view = makeView();
  const html = view.renderTranscript({
    previousTurns: [],
    latestTurn: null,
    queuedSubmissions: [],
  });

  assert.match(html, /flow-empty/);
  assert.match(html, /session\.noMessages/);
});

test("runtimeSessionTranscriptView: 可疑旧历史显示保守提示", () => {
  const view = makeView();
  const html = view.renderTurn({
    id: "t1",
    task: "旧问题",
    status: "completed",
    meta: { historyIntegrity: "legacy_unverified" },
  }, 0);

  assert.match(html, /turn-history-integrity-warning/);
  assert.match(html, /turn\.historyIntegrityWarning/);
});
