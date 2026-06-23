import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeAliveController } from "./runtimeAliveController.js";

function makeHarness({ aliveIds = [] } = {}) {
  const session = {
    id: "session-1",
    providerId: "demo",
    providerName: "Demo",
    lifecycle: "live",
    access_mode: "interactive",
    acpSessionId: "acp-1",
  };
  const refreshes = [];
  const notices = [];
  const controller = createRuntimeAliveController({
    getSessionsSnapshot: () => [session],
    sessionRuntimeState: (item) => item.lifecycle,
    acpRuntimeClient: {
      canHandle: () => true,
      aliveIds: async () => aliveIds,
    },
    setSessionLifecycle: (item, lifecycle) => { item.lifecycle = lifecycle; },
    setSessionAccessMode: (item, mode) => { item.access_mode = mode; },
    setRuntimeBinding: (item, patch) => {
      item.runtime_binding = { ...(item.runtime_binding || {}), ...patch };
    },
    markSessionInactive: (id) => { session.inactiveId = id; },
    shellSurface: {
      refresh: (options) => refreshes.push(options),
    },
    setAppNotice: (message, kind) => notices.push({ message, kind }),
    t: (key) => key,
    logger: { error: () => {} },
  });
  return { controller, session, refreshes, notices };
}

test("runtimeAliveController: runtime exit atomically becomes read-only resume_failed", async () => {
  const { controller, session, refreshes, notices } = makeHarness();

  const changed = await controller.sync();

  assert.equal(changed, true);
  assert.equal(session.lifecycle, "resume_failed");
  assert.equal(session.access_mode, "read_only");
  assert.equal(session.runtime_binding.state, "failed");
  assert.equal(session.runtime_binding.stage, "runtime");
  assert.equal(session.inactiveId, session.id);
  assert.deepEqual(refreshes, [{ workspace: true, history: true, workspaceStatus: true }]);
  assert.deepEqual(notices, [{ message: "runtime.aliveExited", kind: "error" }]);
});

test("runtimeAliveController: alive runtime keeps interactive state unchanged", async () => {
  const { controller, session, refreshes, notices } = makeHarness({
    aliveIds: ["session-1"],
  });

  const changed = await controller.sync();

  assert.equal(changed, false);
  assert.equal(session.lifecycle, "live");
  assert.equal(session.access_mode, "interactive");
  assert.equal(session.runtime_binding, undefined);
  assert.deepEqual(refreshes, []);
  assert.deepEqual(notices, []);
});
