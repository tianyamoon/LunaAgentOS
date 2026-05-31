import test from "node:test";
import assert from "node:assert/strict";
import { createSessionLifecycleController } from "./sessionLifecycleController.js";

// 创建生命周期控制器的最小可观察依赖。
function makeHarness({ sessionOverrides = {}, archived = null, shutdownError = null } = {}) {
  const sessions = [{ id: "s1", agentName: "Agent", task: "Task", lifecycle: "live", turns: [], ...sessionOverrides }];
  const notices = [];
  const calls = [];
  let currentSessionId = "s1";
  const historyRepository = {
    archiveSession: async (id) => { calls.push(`archive:${id}`); },
    deleteSession: async (id) => { calls.push(`delete:${id}`); return { removedCount: 1 }; },
  };
  const controller = createSessionLifecycleController({
    getSession: (id) => sessions.find((item) => item.id === id) || null,
    getArchivedSession: (id) => archived?.id === id ? archived : null,
    getCurrentSessionId: () => currentSessionId,
    sessionRuntimeState: (session) => session.lifecycle,
    isSessionExecuting: (session) => Boolean(session.executing),
    setSessionLifecycle: (session, lifecycle) => { session.lifecycle = lifecycle; calls.push(`lifecycle:${lifecycle}`); },
    markSessionDeletedTombstone: (id) => calls.push(`tombstone:${id}`),
    markSessionStopped: () => ({ id: "turn-stopped" }),
    acpRuntimeClient: {
      shutdown: async () => {
        calls.push("shutdown");
        if (shutdownError) throw shutdownError;
      },
    },
    historyRepository,
    saveTurnToHistory: async () => { calls.push("save"); },
    removeSessionById: (id) => {
      const index = sessions.findIndex((item) => item.id === id);
      if (index >= 0) sessions.splice(index, 1);
    },
    markSessionInactive: (id) => calls.push(`inactive:${id}`),
    clearCurrentSessionIf: (id) => { if (currentSessionId === id) currentSessionId = null; },
    clearScheduledWorkspaceFocus: (id) => calls.push(`focus-clear:${id}`),
    renderProviders: () => {},
    renderWorkspace: () => {},
    renderHistory: () => {},
    openConfirmDialog: (options) => { calls.push(options); },
    formatBackendError: (error) => error.message,
    setAppNotice: (message, kind) => notices.push({ message, kind }),
    t: (key, params = {}) => params.agent ? `${key}:${params.agent}` : key,
    logger: { error: () => calls.push("logged") },
  });
  return { controller, sessions, notices, calls };
}

test("sessionLifecycleController: archive stops executing runtime and removes workspace session", async () => {
  const { controller, sessions, calls } = makeHarness({ sessionOverrides: { executing: true } });
  await controller.archiveLiveSession("s1");
  assert.deepEqual(sessions, []);
  assert.deepEqual(calls.slice(0, 5), ["lifecycle:stopped", "shutdown", "lifecycle:archived", "archive:s1", "save"]);
});

test("sessionLifecycleController: stop blocks restoring session", async () => {
  const { controller, notices, calls } = makeHarness({ sessionOverrides: { lifecycle: "restoring" } });
  await controller.stopSession("s1");
  assert.equal(notices.at(-1).message, "session.stopRestoringBlocked");
  assert.equal(calls.includes("shutdown"), false);
});

test("sessionLifecycleController: shutdown failure is logged without blocking archive", async () => {
  const { controller, sessions, calls } = makeHarness({ shutdownError: new Error("shutdown") });
  await controller.archiveLiveSession("s1");
  assert.deepEqual(sessions, []);
  assert.equal(calls.includes("logged"), true);
});

test("sessionLifecycleController: dismiss hides session without removing it", async () => {
  const { controller, sessions, calls } = makeHarness();
  await controller.dismissWorkspaceSession("s1");
  assert.equal(sessions[0].inWorkspace, false);
  assert.equal(calls.includes("shutdown"), false);
});

test("sessionLifecycleController: delete archived-only session writes tombstone", async () => {
  const { controller, calls } = makeHarness({ archived: { id: "archived", title: "Archived", runtimeState: "archived" } });
  await controller.deleteSession("archived");
  assert.equal(calls.includes("tombstone:archived"), true);
  assert.equal(calls.includes("delete:archived"), true);
});

test("sessionLifecycleController: delete confirmation delegates to unified command", () => {
  const { controller, calls } = makeHarness();
  controller.requestDeleteConfirmation("s1");
  const dialog = calls.find((item) => typeof item === "object");
  assert.equal(dialog.title, "confirm.deleteSessionTitle");
  assert.equal(typeof dialog.onConfirm, "function");
});
