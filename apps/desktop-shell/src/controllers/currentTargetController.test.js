import test from "node:test";
import assert from "node:assert/strict";

import { createCurrentTargetController } from "./currentTargetController.js";

function createController(overrides = {}) {
  const calls = [];
  let currentSession = overrides.currentSession ?? { id: "s1", agentId: "old-agent" };
  let sendAsNewSession = false;
  const controller = createCurrentTargetController({
    agentById: (id) => ({ id, name: `Agent ${id}` }),
    isTargetSelectable: () => true,
    targetSendBlockNotice: () => "blocked",
    saveCurrentTargetAgent: (id) => calls.push(["save-target", id]),
    getCurrentTargetAgent: () => ({ id: "agent-a", name: "Agent A" }),
    getCurrentTargetProvider: () => ({ id: "provider-a" }),
    getCurrentSession: () => currentSession,
    saveCurrentSession: (id) => {
      calls.push(["save-session", id]);
      currentSession = id ? { id, agentId: "agent-a" } : null;
    },
    setSendAsNewSession: (value) => {
      calls.push(["send-new", value]);
      sendAsNewSession = value;
    },
    updateActionLabels: () => calls.push(["actions"]),
    renderProviders: () => calls.push(["providers"]),
    renderWorkspaceStatus: () => calls.push(["workspace-status"]),
    renderWorkspace: () => calls.push(["workspace"]),
    renderHistory: () => calls.push(["history"]),
    setAppNotice: (message, tone) => calls.push(["notice", message, tone]),
    targetDisplayName: (agent) => agent.name,
    focusComposerInput: () => calls.push(["focus"]),
    t: (key, params = {}) => `${key}:${params.target || ""}`,
    ...overrides,
  });
  return {
    calls,
    controller,
    getSendAsNewSession: () => sendAsNewSession,
  };
}

test("currentTargetController: 切到不同 Agent 会清空当前 Session 并进入新会话模式", () => {
  const { controller, calls, getSendAsNewSession } = createController();

  assert.equal(controller.setCurrentTargetAgent("agent-a"), true);

  assert.deepEqual(calls.slice(0, 3), [
    ["save-target", "agent-a"],
    ["save-session", null],
    ["send-new", true],
  ]);
  assert.equal(getSendAsNewSession(), true);
  assert.deepEqual(calls.slice(-4), [
    ["providers"],
    ["workspace"],
    ["history"],
    ["focus"],
  ]);
});

test("currentTargetController: 不可选择目标只提示并刷新 Fleet 与动作", () => {
  const { controller, calls } = createController({
    isTargetSelectable: () => false,
  });

  assert.equal(controller.setCurrentTargetAgent("blocked-agent"), false);

  assert.deepEqual(calls, [
    ["notice", "blocked", "error"],
    ["providers"],
    ["actions"],
  ]);
});

test("currentTargetController: 没有当前 Session 时进入新会话模式", () => {
  const { controller, calls } = createController({ currentSession: null });

  controller.setCurrentTargetAgent("agent-a");

  assert.ok(calls.some((call) => call[0] === "send-new" && call[1] === true));
});
