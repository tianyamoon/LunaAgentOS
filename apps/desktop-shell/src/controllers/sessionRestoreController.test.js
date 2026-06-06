import test from "node:test";
import assert from "node:assert/strict";
import { createShellSurface } from "../ui/shellSurface.js";
import { createSessionRestoreController } from "./sessionRestoreController.js";

// 创建可观察状态变化的控制器依赖。
function makeHarness({ archivedOverrides = {}, runtime = {} } = {}) {
  const archived = { id: "s1", agentId: "a1", providerId: "demo", acpSessionId: "acp-1", ...archivedOverrides };
  const sessions = [];
  const notices = [];
  const workspaceRenders = [];
  const historyRenders = [];
  const logs = [];
  let currentSessionId = null;
  const restored = { ...archived, lifecycle: "archived" };
  const shellSurface = createShellSurface({
    renderProviders: () => {},
    renderWorkspace: (options = {}) => workspaceRenders.push(options),
    renderHistory: (options = {}) => historyRenders.push(options),
    focusComposerInput: () => {},
  });
  const acpRuntimeClient = {
    canHandle: () => true,
    load: async () => {},
    resume: async () => {},
    shutdown: async () => {},
    verifyAlive: async () => {},
    ...runtime,
  };
  const controller = createSessionRestoreController({
    getArchivedSessions: () => [archived],
    getSessionsSnapshot: () => [...sessions],
    getCurrentSessionId: () => currentSessionId,
    workspaceSessionFromArchived: (_archived, existing) => existing || restored,
    sessionRuntimeState: (session) => session.lifecycle,
    setSessionRecordState: (session, state) => { session.record_state = state; },
    setSessionAccessMode: (session, mode) => { session.access_mode = mode; },
    setSessionLifecycle: (session, lifecycle) => {
      session.lifecycle = lifecycle;
      if (lifecycle === "archived") session.record_state = "archived";
      if (["live", "restoring", "resume_failed", "stopped"].includes(lifecycle)) session.record_state = "active";
    },
    setRuntimeBinding: (session, patch) => { session.runtime_binding = { ...(session.runtime_binding || {}), ...patch }; },
    clearRuntimeBindingError: (session) => { session.runtime_binding = { state: "connected" }; },
    markSessionInactive: (id) => { restored.inactive = id; },
    markSessionActive: (id) => { restored.active = id; },
    upsertSession: (session) => { sessions.unshift(session); },
    unmarkStopped: () => {},
    saveCurrentTargetAgent: () => {},
    saveCurrentSession: (id) => { currentSessionId = id; },
    activateWorkspaceSession: (id) => { currentSessionId = id; },
    shellSurface,
    acpRuntimeClient,
    appendRuntimeLog: (_session, log) => logs.push(log),
    markPromptError: (_session, turn, message) => { turn.error = message; },
    formatBackendError: (error) => error.message,
    compactNoticeText: (text) => text,
    setAppNotice: (message, kind) => notices.push({ message, kind }),
    t: (key, params = {}) => params.error ? `${key}:${params.error}` : key,
    logger: { error: () => {} },
  });
  return { controller, restored, notices, workspaceRenders, historyRenders, logs, setCurrentSessionId: (id) => { currentSessionId = id; } };
}

test("sessionRestoreController: load success becomes live and validates first turn", async () => {
  const { controller, restored, notices } = makeHarness();
  await controller.restoreArchivedSession("s1");
  assert.equal(restored.lifecycle, "live");
  assert.equal(restored.access_mode, "interactive");
  assert.equal(restored.resume_validation.phase, "pending");
  assert.equal(notices.at(-1).message, "restore.reconnected");
});

test("sessionRestoreController: load failure falls back to resume", async () => {
  let resumed = false;
  const { controller, restored, notices } = makeHarness({
    runtime: {
      load: async () => { throw new Error("load"); },
      resume: async () => { resumed = true; },
    },
  });
  await controller.restoreArchivedSession("s1");
  assert.equal(resumed, true);
  assert.equal(restored.lifecycle, "live");
  assert.equal(notices.at(-1).message, "restore.loadFailedResumed");
});

test("sessionRestoreController: complete failure becomes read-only resume_failed", async () => {
  const { controller, restored, notices, logs } = makeHarness({
    runtime: {
      load: async () => { throw new Error("load"); },
      resume: async () => { throw new Error("resume"); },
    },
  });
  await controller.restoreArchivedSession("s1");
  assert.equal(restored.lifecycle, "resume_failed");
  assert.equal(restored.access_mode, "read_only");
  assert.equal(restored.runtime_binding.stage, "resume");
  assert.match(logs[0], /restore.resumeFailedLine:resume/);
  assert.equal(notices.at(-1).kind, "error");
});

test("sessionRestoreController: missing ACP id opens read-only without runtime calls", async () => {
  let loaded = false;
  const { controller, restored, notices } = makeHarness({
    archivedOverrides: { acpSessionId: null },
    runtime: { load: async () => { loaded = true; } },
  });
  await controller.restoreArchivedSession("s1");
  assert.equal(loaded, false);
  assert.equal(restored.lifecycle, "archived");
  assert.equal(restored.access_mode, "read_only");
  assert.equal(notices.at(-1).message, "restore.readOnlyMissingSession");
});

test("sessionRestoreController: opening an active read-only transcript does not archive it", () => {
  const { controller, restored } = makeHarness({
    archivedOverrides: { record_state: "active", access_mode: "read_only" },
  });
  controller.openArchivedTranscript("s1");
  assert.equal(restored.record_state, "active");
  assert.equal(restored.access_mode, "read_only");
});

test("sessionRestoreController: missing ACP id keeps source record_state active", async () => {
  const { controller, restored } = makeHarness({
    archivedOverrides: { acpSessionId: null, record_state: "active" },
  });
  await controller.restoreArchivedSession("s1");
  assert.equal(restored.lifecycle, "archived");
  assert.equal(restored.record_state, "active");
  assert.equal(restored.access_mode, "read_only");
});

test("sessionRestoreController: explicit archived source remains archived when opened read-only", () => {
  const { controller, restored } = makeHarness({
    archivedOverrides: { record_state: "archived", access_mode: "read_only" },
  });
  controller.openArchivedTranscript("s1");
  assert.equal(restored.record_state, "archived");
  assert.equal(restored.access_mode, "read_only");
});

test("sessionRestoreController: switched focus preserves deck scroll after async restore", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const harness = makeHarness({
    runtime: { load: async () => pending },
  });
  const restoring = harness.controller.restoreArchivedSession("s1");
  harness.setCurrentSessionId("other");
  release();
  await restoring;
  assert.deepEqual(harness.workspaceRenders.at(-1), { preserveDeckScroll: true });
  assert.deepEqual(harness.historyRenders.at(-1), {});
});

test("sessionRestoreController: first-turn failure rolls back to read-only", () => {
  const { controller, restored, notices } = makeHarness();
  const turn = {};
  controller.rollbackFirstTurnPromptFailure(restored, turn, "bad request");
  assert.equal(turn.error, "bad request");
  assert.equal(restored.lifecycle, "resume_failed");
  assert.equal(restored.access_mode, "read_only");
  assert.equal(restored.runtime_binding.stage, "prompt");
  assert.equal(notices.at(-1).kind, "error");
});
