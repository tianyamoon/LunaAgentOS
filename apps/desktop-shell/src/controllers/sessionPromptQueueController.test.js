import test from "node:test";
import assert from "node:assert/strict";
import { createSessionPromptQueueController } from "./sessionPromptQueueController.js";
import { createShellSurface } from "../ui/shellSurface.js";

// 创建队列测试夹具，记录 Turn 创建和 Runtime 派发顺序。
function makeHarness({ persistTurnSnapshot } = {}) {
  const calls = [];
  let turnSeq = 0;
  const shellSurface = createShellSurface({
    renderWorkspace: () => calls.push("workspace"),
    renderHistory: () => calls.push("history"),
  });
  const controller = createSessionPromptQueueController({
    createSessionTurn: (session, task, options) => {
      turnSeq += 1;
      const turn = { id: `turn-${turnSeq}`, task, ...options };
      session.turns.push(turn);
      return turn;
    },
    dispatchPromptRun: (_session, turn) => calls.push(`dispatch:${turn.id}`),
    persistTurnSnapshot: persistTurnSnapshot || ((_session, turn) => calls.push(`persist:${turn.id}`)),
    shellSurface,
    setAppNotice: (message, tone) => calls.push(`notice:${tone}:${message}`),
    t: (key, values = {}) => `${key}:${values.count || ""}`,
    now: () => 100,
  });
  return { calls, controller };
}

test("sessionPromptQueueController: 空闲 Session 立即创建 Turn 并派发", () => {
  const session = { id: "s1", turns: [] };
  const { calls, controller } = makeHarness();
  const result = controller.submit(session, "第一条");

  assert.equal(result.queued, false);
  assert.equal(session.turns.length, 1);
  assert.equal(calls.includes("dispatch:turn-1"), true);
});

test("sessionPromptQueueController: 运行中输入进入 FIFO 队列且不会提前创建 Turn", () => {
  const session = { id: "s1", turns: [], activePromptRunId: "run-1" };
  const { controller } = makeHarness();
  controller.submit(session, "第二条");
  controller.submit(session, "第三条");

  assert.equal(session.turns.length, 0);
  assert.deepEqual(session.queuedSubmissions.map((item) => item.task), ["第二条", "第三条"]);
});

test("sessionPromptQueueController: pump 按 FIFO 启动下一条输入", () => {
  const session = { id: "s1", turns: [], activePromptRunId: "run-1" };
  const { calls, controller } = makeHarness();
  controller.submit(session, "第二条");
  controller.submit(session, "第三条");
  session.activePromptRunId = null;

  const result = controller.pump(session);

  assert.equal(result.turn.task, "第二条");
  assert.deepEqual(session.queuedSubmissions.map((item) => item.task), ["第三条"]);
  assert.equal(calls.includes("dispatch:turn-1"), true);
});

test("sessionPromptQueueController: 排队附件保存发送瞬间快照", () => {
  const attachment = { name: "a.md", status: "ready" };
  const session = { id: "s1", turns: [], activePromptRunId: "run-1" };
  const { controller } = makeHarness();
  controller.submit(session, "第二条", { attachments: [attachment] });
  attachment.name = "changed.md";

  assert.equal(session.queuedSubmissions[0].attachments[0].name, "a.md");
});

test("sessionPromptQueueController: clear 清空队列并记录原因", () => {
  const session = { id: "s1", turns: [], activePromptRunId: "run-1" };
  const { controller } = makeHarness();
  controller.submit(session, "第二条");

  assert.equal(controller.clear(session, "stop"), 1);
  assert.deepEqual(session.queuedSubmissions, []);
  assert.equal(session.discardedQueuedSubmissions[0].reason, "stop");
});
test("sessionPromptQueueController: 新 Turn 在派发 runtime 前先写入历史快照", () => {
  const session = { id: "s1", turns: [] };
  const { calls, controller } = makeHarness();
  controller.submit(session, "task");

  assert.deepEqual(
    calls.filter((item) => item.startsWith("persist:") || item.startsWith("dispatch:")),
    ["persist:turn-1", "dispatch:turn-1"],
  );
});
