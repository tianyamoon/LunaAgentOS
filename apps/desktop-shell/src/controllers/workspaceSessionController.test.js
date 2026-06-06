import test from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceViewStore, WORKSPACE_VIEW_MODE } from "../state/workspaceViewStore.js";
import { createSessionsStore } from "../state/sessionsStore.js";
import { createShellSurface } from "../ui/shellSurface.js";
import { createWorkspaceSessionController } from "./workspaceSessionController.js";

function makeHarness(overrides = {}) {
  const sessionsStore = createSessionsStore();
  const workspaceViewStore = createWorkspaceViewStore(overrides.workspaceView || {});
  const sessions = [
    { id: "a", agentId: "agent-a", task: "task a", runtimeState: "live", sendable: true },
    { id: "b", agentId: "agent-b", task: "task b", runtimeState: "live", sendable: true },
  ];
  sessionsStore.replaceSessions(sessions);
  const calls = [];
  const shellSurface = createShellSurface({
    updateActionLabels: () => calls.push(["labels"]),
    renderProviders: () => calls.push(["providers"]),
    renderWorkspace: (options = {}) => calls.push(["workspace", options]),
    renderHistory: (options = {}) => calls.push(["history", options]),
    focusComposerInput: () => calls.push(["focusComposer"]),
  });
  const controller = createWorkspaceSessionController({
    getSession: (id) => sessionsStore.getSession(id),
    workspaceViewStore,
    saveCurrentTargetAgent: (id) => calls.push(["target", id]),
    saveCurrentSession: (id) => sessionsStore.setCurrentSessionId(id),
    canSendToSession: (session) => session.sendable !== false,
    markSessionActive: (id) => calls.push(["active", id]),
    shellSurface,
    sessionRuntimeState: (session) => session.runtimeState,
    setAppNotice: (message) => calls.push(["notice", message]),
    t: (key, params = {}) => `${key}${params.task ? `:${params.task}` : ""}`,
  });
  return { calls, controller, sessionsStore, workspaceViewStore };
}

test("workspaceSessionController: history activation updates current session", () => {
  const { controller, sessionsStore, workspaceViewStore, calls } = makeHarness();
  assert.equal(controller.activateWorkspaceSession("b", { focusWorkspace: true }), true);
  assert.equal(sessionsStore.getCurrentSessionId(), "b");
  assert.equal(workspaceViewStore.getMode(), WORKSPACE_VIEW_MODE.grid);
  assert.deepEqual(calls.find((call) => call[0] === "workspace"), ["workspace", { focusSessionId: "b" }]);
});

test("workspaceSessionController: activation switches focused session while focused", () => {
  const { controller, workspaceViewStore } = makeHarness({
    workspaceView: { mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" },
  });
  controller.activateWorkspaceSession("b", { focusWorkspace: true });
  assert.equal(workspaceViewStore.getMode(), WORKSPACE_VIEW_MODE.focused);
  assert.equal(workspaceViewStore.getFocusedSessionId(), "b");
});

test("workspaceSessionController: mini card focus and activation share focused state", () => {
  const { controller, workspaceViewStore, sessionsStore } = makeHarness({
    workspaceView: { mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" },
  });
  controller.focusSessionInWorkspace("b");
  controller.activateWorkspaceSession("b");
  assert.equal(workspaceViewStore.getFocusedSessionId(), "b");
  assert.equal(sessionsStore.getCurrentSessionId(), "b");
});

test("workspaceSessionController: fullscreen button toggles focus without mutating session fullscreen", () => {
  const { controller, workspaceViewStore } = makeHarness();
  controller.toggleSessionFocus("a");
  assert.equal(workspaceViewStore.getFocusedSessionId(), "a");
  controller.toggleSessionFocus("a");
  assert.equal(workspaceViewStore.getFocusedSessionId(), null);
});
