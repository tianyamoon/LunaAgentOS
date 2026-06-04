import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceStatusView } from "./workspaceStatusView.js";
import { RECORD_STATE } from "../state/sessionStatus.js";

function createElementStub() {
  return {
    textContent: "",
    innerHTML: "",
  };
}

function createView(overrides = {}) {
  const element = createElementStub();
  const view = createWorkspaceStatusView({
    element,
    getCurrentTargetAgent: () => ({ id: "agent-a", name: "Hermes", state: 1 }),
    getCurrentTargetProvider: () => ({ id: "hermes" }),
    getSessionsSnapshot: () => [
      { id: "s1", agentId: "agent-a", state: 2, createdAt: "2026-01-01T00:00:00.000Z", record_state: RECORD_STATE.active },
      { id: "s2", agentId: "agent-b", state: 5, createdAt: "2026-01-02T00:00:00.000Z", record_state: RECORD_STATE.archived },
    ],
    getCurrentSession: () => null,
    getLatestActiveSessionForAgent: () => null,
    getProviderAvailability: () => ({ summary: "available" }),
    sessionRecordState: (session) => session.record_state,
    targetDisplayName: (agent) => agent.name,
    providerAvailabilityLabel: (summary) => `availability:${summary}`,
    stateClasses: { 2: "state-think" },
    stateDisplayLabel: (state) => `state:${state}`,
    t: (key) => `t:${key}`,
    escapeHtml: (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
    ...overrides,
  });
  return { element, view };
}

test("workspaceStatusView: 渲染目标、状态、可用性和活跃 ACP 数量", () => {
  const { element, view } = createView();

  view.renderWorkspaceStatus();

  assert.match(element.innerHTML, /workspace-status-target/);
  assert.match(element.innerHTML, /Hermes/);
  assert.match(element.innerHTML, /state-think/);
  assert.match(element.innerHTML, /state:2/);
  assert.match(element.innerHTML, /availability:available/);
  assert.match(element.innerHTML, /ACP × 1/);
});

test("workspaceStatusView: 缺少目标时只写入占位文案", () => {
  const { element, view } = createView({
    getCurrentTargetAgent: () => null,
    getCurrentTargetProvider: () => null,
  });

  view.renderWorkspaceStatus();

  assert.equal(element.textContent, "t:composer.placeholderNoTarget");
  assert.equal(element.innerHTML, "");
});

test("workspaceStatusView: 状态条会转义目标名称", () => {
  const { element, view } = createView({
    getCurrentTargetAgent: () => ({ id: "agent-a", name: "<Hermes>" }),
    targetDisplayName: (agent) => agent.name,
  });

  view.renderWorkspaceStatus();

  assert.match(element.innerHTML, /&lt;Hermes&gt;/);
  assert.doesNotMatch(element.innerHTML, /<Hermes>/);
});
