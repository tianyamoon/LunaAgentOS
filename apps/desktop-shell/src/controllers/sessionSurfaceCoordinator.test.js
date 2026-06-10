import test from "node:test";
import assert from "node:assert/strict";

import { createSessionsStore } from "../state/sessionsStore.js";
import { createSessionSurfaceCoordinator } from "./sessionSurfaceCoordinator.js";

function createFrameHarness() {
  const frames = [];
  return {
    requestFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    flush() {
      frames.shift()?.();
    },
    frames,
  };
}

test("sessionSurfaceCoordinator: 同一帧的状态变化只刷新一次相关界面", () => {
  const sessionsStore = createSessionsStore();
  const harness = createFrameHarness();
  const calls = [];
  sessionsStore.replaceSessions([{ id: "s1", title: "demo", turns: [] }]);

  const coordinator = createSessionSurfaceCoordinator({
    sessionsStore,
    refreshSessionCard: (sessionId) => calls.push(["card", sessionId]),
    shellSurface: {
      refresh(options) {
        calls.push(["surface", options]);
      },
    },
    requestFrame: harness.requestFrame,
  });

  sessionsStore.batch(() => {
    sessionsStore.updateSession("s1", (session) => {
      session.lifecycle = "live";
      return true;
    });
    sessionsStore.updateSession("s1", (session) => {
      session.access_mode = "interactive";
      return true;
    });
  });
  coordinator.invalidate({ sessionId: "s1", history: false });

  assert.equal(harness.frames.length, 1);
  assert.deepEqual(calls, []);

  harness.flush();
  assert.deepEqual(calls, [
    ["card", "s1"],
    ["surface", { workspaceStatus: true, history: true }],
  ]);
  coordinator.dispose();
});

test("sessionSurfaceCoordinator: 流式变化保留延迟 Card 刷新且不刷新历史列表", () => {
  const sessionsStore = createSessionsStore();
  const harness = createFrameHarness();
  const calls = [];
  const coordinator = createSessionSurfaceCoordinator({
    sessionsStore,
    refreshSessionCard: (sessionId) => calls.push(["immediate", sessionId]),
    scheduleSessionCardRender: (sessionId) => calls.push(["deferred", sessionId]),
    shellSurface: {
      refresh(options) {
        calls.push(["surface", options]);
      },
    },
    requestFrame: harness.requestFrame,
  });

  coordinator.invalidate({ sessionId: "s1", deferCard: true, history: false });
  harness.flush();

  assert.deepEqual(calls, [
    ["deferred", "s1"],
    ["surface", { workspaceStatus: true, history: false }],
  ]);
  coordinator.dispose();
});

test("sessionSurfaceCoordinator: detached or unrelated store changes do not refresh session surfaces", () => {
  const sessionsStore = createSessionsStore();
  const harness = createFrameHarness();
  const calls = [];
  const coordinator = createSessionSurfaceCoordinator({
    sessionsStore,
    scheduleSessionCardRender: (sessionId) => calls.push(["card", sessionId]),
    shellSurface: {
      refresh(options) {
        calls.push(["surface", options]);
      },
    },
    requestFrame: harness.requestFrame,
  });

  sessionsStore.setFlowDetailOpen("turn:debug", true);

  assert.equal(harness.frames.length, 0);
  assert.deepEqual(calls, []);
  coordinator.dispose();
});
