import test from "node:test";
import assert from "node:assert/strict";
import { createShellSurface } from "../ui/shellSurface.js";
import { createSessionLaunchController } from "./sessionLaunchController.js";

// 创建可观察发送行为的控制器夹具，覆盖 Launch Controller 的稳定接口。
function makeHarness({
  prompt = "检查项目",
  attachments = [],
  canStart = true,
  canSendProvider = true,
  commands = { prompt: "runtime_prompt" },
  currentSession = null,
  currentSessionActive = true,
  currentSessionRestorable = false,
  blockReason = "",
  modelControl = null,
  savedDefaultModel = "",
} = {}) {
  const sessions = [];
  const calls = [];
  let promptValue = prompt;
  let activeSession = currentSession;
  let composerAttachments = attachments;
  const agent = { id: "agent-1", providerId: "demo", name: "Demo Agent", runtimeHost: "win", modelControl };
  const provider = { id: "demo", name: "Demo" };
  const shellSurface = createShellSurface({
    focusComposerInput: () => calls.push("focus"),
    renderWorkspace: () => calls.push("workspace"),
    renderHistory: () => calls.push("history"),
    updateActionLabels: () => calls.push("labels"),
  });
  const sessionPromptQueue = {
    submit: (session, task, options) => {
      if (session.activePromptRunId) {
        session.queuedSubmissions = [...(session.queuedSubmissions || []), { task, ...options }];
        return { queued: true, turn: null };
      }
      const turn = { id: "turn-1", task, ...options };
      session.turns.push(turn);
      if (commands) calls.push(`acp:${turn.id}`);
      else calls.push(`fallback:${turn.id}`);
      return { queued: false, turn };
    },
  };
  const controller = createSessionLaunchController({
    getPromptValue: () => promptValue,
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
    canRestoreSession: () => currentSessionRestorable,
    currentSessionSendBlockReason: () => blockReason,
    normalizeWorkspaceSession: (session) => session,
    upsertSession: (session) => {
      sessions.unshift(session);
      activeSession = session;
    },
    markSessionActive: (sessionId) => calls.push(`active:${sessionId}`),
    isSessionActive: () => currentSessionActive,
    saveCurrentSession: (sessionId) => calls.push(`current:${sessionId}`),
    unmarkStopped: (sessionId) => calls.push(`unstopped:${sessionId}`),
    createSessionTurn: (session, task, options) => {
      const turn = { id: "turn-1", task, ...options };
      session.turns.push(turn);
      return turn;
    },
    sessionPromptQueue,
    shellSurface,
    setSendAsNewSession: (value) => calls.push(`new:${value}`),
    isTargetActivatable: () => false,
    acpCommandsForProvider: () => commands,
    startAcpSession: (_session, turn) => calls.push(`acp:${turn.id}`),
    runFallbackSession: (_session, turn) => calls.push(`fallback:${turn.id}`),
    setAppNotice: (message, kind) => calls.push(`notice:${kind}:${message}`),
    t: (key, values = {}) => {
      if (values.provider) return `${key}:${values.provider}:${values.state}`;
      if (values.target) return `${key}:${values.target}`;
      return key;
    },
    defaultModelForTarget: () => savedDefaultModel,
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

test("sessionLaunchController: read-only transcript blocks normal send", () => {
  const currentSession = {
    id: "history-readonly",
    agentId: "agent-1",
    access_mode: "read_only",
    turns: [],
  };
  const { calls, controller, sessions } = makeHarness({
    currentSession,
    currentSessionActive: false,
    currentSessionRestorable: true,
    blockReason: "should-not-block",
  });
  const result = controller.startSessionFromPrompt();

  assert.equal(result, null);
  assert.equal(sessions.length, 0);
  assert.equal(calls.some((item) => item === "notice:error:should-not-block"), false);
  assert.equal(calls.includes("notice:error:session.readOnlySwitchBlocked"), true);
});

test("sessionLaunchController: Luna-managed default model is copied only to a new Session", () => {
  const { controller, sessions } = makeHarness({
    modelControl: { mode: "luna_managed", availableModels: ["model-1", "model-2"] },
    savedDefaultModel: "model-2",
  });
  controller.startSessionFromPrompt();
  assert.equal(sessions[0].defaultModel, "model-2");
});

test("sessionLaunchController: unrestorable history explains that a new session is required", () => {
  const currentSession = {
    id: "history-without-runtime-id",
    agentId: "agent-1",
    access_mode: "read_only",
    turns: [],
  };
  const { calls, controller } = makeHarness({
    currentSession,
    currentSessionActive: false,
    currentSessionRestorable: false,
  });

  assert.equal(controller.startSessionFromPrompt(), null);
  assert.equal(calls.includes("notice:error:session.readOnlyCannotRestore"), true);
});

test("sessionLaunchController: restorable history points to the restore action", () => {
  const currentSession = {
    id: "history-with-runtime-id",
    agentId: "agent-1",
    access_mode: "read_only",
    turns: [],
  };
  const { calls, controller } = makeHarness({
    currentSession,
    currentSessionActive: false,
    currentSessionRestorable: true,
  });

  assert.equal(controller.startSessionFromPrompt(), null);
  assert.equal(calls.includes("notice:error:session.readOnlySwitchBlocked"), true);
  assert.equal(calls.includes("notice:error:session.readOnlyCannotRestore"), false);
});

test("sessionLaunchController: detached failed session cannot silently start a new session", () => {
  const currentSession = {
    id: "session-failed",
    agentId: "agent-1",
    access_mode: "interactive",
    turns: [],
  };
  const { calls, controller, sessions } = makeHarness({
    currentSession,
    currentSessionActive: false,
    blockReason: "session-not-sendable",
  });
  const result = controller.startSessionFromPrompt();

  assert.equal(result, null);
  assert.equal(sessions.length, 0);
  assert.equal(calls.includes("notice:error:session-not-sendable"), true);
});

test("sessionLaunchController: explicit new session can branch from read-only transcript", () => {
  const currentSession = {
    id: "history-readonly",
    agentId: "agent-1",
    access_mode: "read_only",
    turns: [],
  };
  const { calls, controller, sessions } = makeHarness({
    currentSession,
    currentSessionActive: false,
    currentSessionRestorable: true,
    blockReason: "should-not-block",
  });
  const result = controller.startSessionFromPrompt(true);

  assert.equal(sessions.length, 1);
  assert.notEqual(result.session, currentSession);
  assert.equal(result.session.task, "检查项目");
  assert.equal(calls.some((item) => item === "notice:error:should-not-block"), false);
  assert.equal(calls.includes("notice:busy:session.startedNewFromHistory:Demo Agent"), true);
});

test("sessionLaunchController: composer new-session toggle can branch from read-only transcript", () => {
  const currentSession = {
    id: "history-readonly",
    agentId: "agent-1",
    access_mode: "read_only",
    turns: [],
  };
  const { calls, controller, sessions } = makeHarness({
    currentSession,
    currentSessionActive: false,
    currentSessionRestorable: true,
    blockReason: "should-not-block",
  });
  const result = controller.startSessionFromPrompt(true);

  assert.equal(sessions.length, 1);
  assert.notEqual(result.session, currentSession);
  assert.equal(calls.includes("notice:error:session.readOnlySwitchBlocked"), false);
  assert.equal(calls.includes("notice:busy:session.startedNewFromHistory:Demo Agent"), true);
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

test("sessionLaunchController: 运行中 Session 的 follow-up 进入队列且不会提前执行", () => {
  const currentSession = { id: "session-old", agentId: "agent-1", turns: [], activePromptRunId: "run-1" };
  const { calls, controller } = makeHarness({ currentSession, prompt: "第二条" });
  const result = controller.startSessionFromPrompt();

  assert.equal(result.queued, true);
  assert.deepEqual(currentSession.queuedSubmissions.map((item) => item.task), ["第二条"]);
  assert.equal(calls.some((item) => item.startsWith("acp:")), false);
});
