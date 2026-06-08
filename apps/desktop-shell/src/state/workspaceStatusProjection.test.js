import test from "node:test";
import assert from "node:assert/strict";

import {
  countRestorableActiveHistoryItems,
  pickWorkspaceStatusSession,
  projectWorkspaceEmptyCopy,
  projectWorkspaceStatus,
} from "./workspaceStatusProjection.js";
import { ACCESS_MODE, RECORD_STATE } from "./sessionStatus.js";

test("workspaceStatusProjection: 空态会提示右侧可恢复活跃历史", () => {
  const restorableCount = countRestorableActiveHistoryItems({
    sessions: [{ id: "live-a" }],
    archivedSessions: [
      { id: "live-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.interactive },
      { id: "restore-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.interactive },
      { id: "readonly-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.read_only },
      { id: "archived-a", record_state: RECORD_STATE.archived, access_mode: ACCESS_MODE.read_only },
    ],
  });

  assert.equal(restorableCount, 1);
  assert.deepEqual(projectWorkspaceEmptyCopy({ restorableCount }), {
    titleKey: "workspace.emptyRestoreTitle",
    textKey: "workspace.emptyRestoreText",
  });
});

test("workspaceStatusProjection: 没有可恢复历史时使用默认空态", () => {
  assert.deepEqual(projectWorkspaceEmptyCopy({ restorableCount: 0 }), {
    titleKey: "workspace.emptyTitle",
    textKey: "workspace.emptyText",
  });
});

test("workspaceStatusProjection: 顶部状态优先当前 Session 再看同 Agent 最新会话", () => {
  const older = { id: "older", agentId: "agent-a", state: 2, createdAt: "2026-01-01T00:00:00.000Z" };
  const newer = { id: "newer", agentId: "agent-a", state: 3, createdAt: "2026-01-02T00:00:00.000Z" };
  const current = { id: "current", agentId: "agent-b", state: 4, createdAt: "2026-01-03T00:00:00.000Z" };

  assert.equal(pickWorkspaceStatusSession({
    currentSession: current,
    latestActiveSession: newer,
    sessions: [older, newer],
    agentId: "agent-a",
  }), current);

  assert.equal(pickWorkspaceStatusSession({
    sessions: [older, newer],
    agentId: "agent-a",
  }), newer);
});

test("workspaceStatusProjection: 产出顶部状态条所需最小视图数据", () => {
  const view = projectWorkspaceStatus({
    agent: { id: "agent-a", name: "Hermes", state: 1 },
    provider: { id: "hermes" },
    sessions: [
      { id: "a", agentId: "agent-a", state: 3, createdAt: "2026-01-01T00:00:00.000Z", record_state: RECORD_STATE.active },
      { id: "b", agentId: "agent-b", state: 2, createdAt: "2026-01-02T00:00:00.000Z", record_state: RECORD_STATE.archived },
    ],
    availability: { summary: "available" },
    targetDisplayName: (agent) => `目标:${agent.name}`,
  });

  assert.equal(view.hasTarget, true);
  assert.equal(view.targetLabel, "目标:Hermes");
  assert.equal(view.statusState, 3);
  assert.equal(view.availabilitySummary, "available");
  assert.equal(view.liveCount, 1);
});

test("workspaceStatusProjection: 缺少目标时返回占位 key", () => {
  assert.deepEqual(projectWorkspaceStatus({}), {
    hasTarget: false,
    placeholderKey: "composer.placeholderNoTarget",
  });
});

test("workspaceStatusProjection: workspace status can consume unified canonical state", () => {
  const view = projectWorkspaceStatus({
    agent: { id: "agent-a", name: "Hermes", state: 2 },
    provider: { id: "hermes" },
    currentSession: {
      id: "s1",
      agentId: "agent-a",
      state: 2,
      turns: [{ id: "t1", status: "completed", finalResponse: "done" }],
    },
    availability: { summary: "available" },
    resolveSessionCanonicalState: () => ({
      statusView: { status: "completed", label: "completed", tone: "success" },
      isRuntimeAttached: true,
    }),
    targetDisplayName: (agent) => agent.name,
  });

  assert.deepEqual(view.sessionStatusView, { status: "completed", label: "completed", tone: "success" });
  assert.equal(view.statusState, 2);
});

test("workspaceStatusProjection: read-only history in workspace snapshot is not counted as live runtime", () => {
  const view = projectWorkspaceStatus({
    agent: { id: "agent-a", name: "Hermes", state: 1 },
    provider: { id: "hermes" },
    sessions: [
      { id: "live", agentId: "agent-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.interactive },
      { id: "history", agentId: "agent-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.read_only },
    ],
    availability: { summary: "available" },
    targetDisplayName: (agent) => agent.name,
  });

  assert.equal(view.liveCount, 1);
});

test("workspaceStatusProjection: 顶部状态使用 canonical 只读状态，忽略历史快照里的旧运行态", () => {
  const view = projectWorkspaceStatus({
    agent: { id: "agent-a", name: "Hermes", state: 1 },
    provider: { id: "hermes" },
    currentSession: {
      id: "history",
      agentId: "agent-a",
      record_state: RECORD_STATE.active,
      access_mode: ACCESS_MODE.read_only,
      turns: [{ id: "t1", status: "running" }],
    },
    availability: { summary: "available" },
    targetDisplayName: (agent) => agent.name,
  });

  assert.equal(view.sessionStatusView.status, "readonly_history");
  assert.equal(view.liveCount, 0);
});
