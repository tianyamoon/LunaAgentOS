import test from "node:test";
import assert from "node:assert/strict";
import { createSessionLaunchController } from "./sessionLaunchController.js";

// 创建可观察发送行为的控制器夹具，覆盖 Launch Controller 的稳定接口。
function makeHarness({
  prompt = "检查项目",
  attachments = [],
  canStart = true,
  canSendProvider = true,
  commands = { prompt: "runtime_prompt" },
  currentSession = null,
  composingNew = false,
} = {}) {
  const sessions = [];
  const calls = [];
  let promptValue = prompt;
  let activeSession = currentSession;
  let composerAttachments = attachments;
  const agent = { id: "agent-1", providerId: "demo", name: "Demo Agent", runtimeHost: "win" };
  const provider = { id: "demo", name: "Demo" };
  const controller = createSessionLaunchController({
    getPromptValue: () => promptValue,
    focusPrompt: () => calls.push("focus"),
    clearPrompt: () => { promptValue = ""; },
    getComposerAttachments: () => composerAttachments,
    clearComposerAttachments: () => { composerAttachments = []; },
    getCurrentTargetAgent: () => agent,
    getCurrentTargetProvider: () => provider,
    providerById: () => provider,
    targetDisplayName: (target) => target.name,
    canTargetStartSession: () => canStart,
    targetSendBlockNotice: () => "target-blocked",
    canSendToProvider: () => canSendProvider,
    providerAvailability: () => ({ summary: "missing" }),
    providerAvailabilityLabel: (summary) => summary,
    getCurrentSession: () => activeSession,
    isComposingNewSession: () => composingNew || !activeSession,
    currentSessionSendBlockReason: () => "",
    normalizeWorkspaceSession: (session) => session,
    upsertSession: (session) => {
      sessions.unshift(session);
      activeSession = session;
    },
    markSessionActive: (sessionId) => calls.push(`active:${sessionId}`),
    isSessionActive: () => true,
    saveCurrentSession: (sessionId) => calls.push(`current:${sessionId}`),
    unmarkStopped: (sessionId) => calls.push(`unstopped:${sessionId}`),
    createSessionTurn: (session, task, options) => {
      const turn = { id: "turn-1", task, ...options };
      session.turns.push(turn);
      return turn;
    },
    renderWorkspace: () => calls.push("workspace"),
    renderHistory: () => calls.push("history"),
    setSendAsNewSession: (value) => calls.push(`new:${value}`),
    updateActionLabels: () => calls.push("labels"),
    isTargetActivatable: () => false,
    acpCommandsForProvider: () => commands,
    startAcpSession: (_session, turn) => calls.push(`acp:${turn.id}`),
    runFallbackSession: (_session, turn) => calls.push(`fallback:${turn.id}`),
    setAppNotice: (message, kind) => calls.push(`notice:${kind}:${message}`),
    t: (key, values = {}) => values.provider ? `${key}:${values.provider}:${values.state}` : key,
    now: () => 100,
  });
  return {
    calls,
    controller,
    getAttachments: () => composerAttachments,
    getPrompt: () => promptValue,
    sessions,
  };
}

test("sessionLaunchController: 创建新 Session 并通过 ACP 发送附件 prompt", () => {
  const attachments = [{
    name: "notes.md",
    type: "text/markdown",
    size: 12,
    content: "附件正文",
  }];
  const { calls, controller, getAttachments, getPrompt, sessions } = makeHarness({ attachments });
  const result = controller.startSessionFromPrompt();

  assert.equal(sessions.length, 1);
  assert.equal(result.session.agentEntrySnapshot.providerId, "demo");
  assert.match(result.turn.runtimePrompt, /附件正文/);
  assert.deepEqual(result.turn.attachments, [{
    name: "notes.md",
    type: "text/markdown",
    size: 12,
    status: "ready",
    truncated: false,
  }]);
  assert.equal(calls.includes("acp:turn-1"), true);
  assert.equal(getPrompt(), "");
  assert.deepEqual(getAttachments(), []);
});

test("sessionLaunchController: 复用同目标的活跃 Session", () => {
  const currentSession = { id: "session-old", agentId: "agent-1", turns: [] };
  const { calls, controller, sessions } = makeHarness({ currentSession });
  const result = controller.startSessionFromPrompt();

  assert.equal(sessions.length, 0);
  assert.equal(result.session, currentSession);
  assert.equal(calls.includes("current:session-old"), true);
});

test("sessionLaunchController: 不可用 Agent Entry 会在创建前阻止发送", () => {
  const { calls, controller, sessions } = makeHarness({ canStart: false });
  const result = controller.startSessionFromPrompt();

  assert.equal(result, null);
  assert.equal(sessions.length, 0);
  assert.equal(calls.includes("notice:error:target-blocked"), true);
});

test("sessionLaunchController: 不可用 Provider 会给出具体提示", () => {
  const { calls, controller, sessions } = makeHarness({ canSendProvider: false });
  const result = controller.startSessionFromPrompt();

  assert.equal(result, null);
  assert.equal(sessions.length, 0);
  assert.equal(calls.includes("notice:error:composer.providerUnavailable:Demo:missing"), true);
});

test("sessionLaunchController: 没有 ACP 命令时路由到 fallback", () => {
  const { calls, controller } = makeHarness({ commands: null });
  controller.startSessionFromPrompt();

  assert.equal(calls.includes("fallback:turn-1"), true);
  assert.equal(calls.includes("acp:turn-1"), false);
});
