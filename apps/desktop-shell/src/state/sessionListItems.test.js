import test from "node:test";
import assert from "node:assert/strict";
import {
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
  isActiveSessionListItem,
  isArchivedSessionListItem,
  projectSessionListItems,
} from "./sessionListItems.js";

function item(id, overrides = {}) {
  return {
    id,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    isInWorkspace: true,
    ...overrides,
  };
}

test("compareActiveSessionListItems keeps workspace sessions ordered by createdAt, not updatedAt", () => {
  const olderButRecentlyUpdated = item("older", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  });
  const newerButQuiet = item("newer", {
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(
    [olderButRecentlyUpdated, newerButQuiet].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );
});

test("compareActiveSessionListItems ignores isInWorkspace so toggling workspace membership never reorders", () => {
  const olderInWorkspace = item("older-workspace", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    isInWorkspace: true,
  });
  const newerDismissed = item("newer-dismissed", {
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    isInWorkspace: false,
  });

  // Newer item stays on top regardless of workspace membership; toggling
  // isInWorkspace on either side does not move them around.
  assert.deepEqual(
    [olderInWorkspace, newerDismissed].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer-dismissed", "older-workspace"],
  );

  olderInWorkspace.isInWorkspace = false;
  newerDismissed.isInWorkspace = true;

  assert.deepEqual(
    [olderInWorkspace, newerDismissed].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer-dismissed", "older-workspace"],
  );
});

test("compareArchivedSessionListItems sorts archived history by createdAt and ignores updatedAt churn", () => {
  const older = item("older", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z", // bumped later by recent activity
  });
  const newer = item("newer", {
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(
    [older, newer].sort(compareArchivedSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );

  // Bumping updatedAt later does not push the older row past the newer one.
  older.updatedAt = "2030-01-01T00:00:00.000Z";
  assert.deepEqual(
    [older, newer].sort(compareArchivedSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );
});

test("projectSessionListItems merges live sessions and archived history without duplicating live ids", () => {
  const liveSession = {
    id: "live-1",
    createdAt: "2026-06-01T12:00:00.000Z",
    task: "继续分析",
    turns: [{
      id: "turn-1",
      createdAt: "2026-06-01T12:01:00.000Z",
      finalResponse: "完成摘要",
      outputs: [],
      logs: [],
    }],
    inWorkspace: false,
  };
  const archivedOnly = {
    id: "archived-1",
    createdAt: "2026-05-30T12:00:00.000Z",
    updatedAt: "2026-05-30T12:10:00.000Z",
    providerName: "Hermes",
  };
  const duplicateArchived = {
    id: "live-1",
    createdAt: "2026-05-01T00:00:00.000Z",
    providerName: "Old",
  };

  const items = projectSessionListItems({
    sessions: [liveSession],
    archivedSessions: [archivedOnly, duplicateArchived],
    normalizeSession: (session) => ({
      ...session,
      providerId: "hermes",
      providerName: "Hermes",
      agentName: "default",
      agentId: "agent-default",
      targetId: "target-default",
    }),
    sessionRuntimeState: () => "live",
    createRuntimeBinding: () => ({ state: "none" }),
    translate: (key) => key,
    constants: {
      RECORD_STATE: { archived: "archived" },
      ACCESS_MODE: { read_only: "read_only" },
    },
  });

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((entry) => entry.id), ["live-1", "archived-1"]);
  assert.equal(items[0].isInWorkspace, false);
  assert.equal(items[0].isRuntimeAttached, true);
  assert.equal(items[0].summary, "完成摘要");
  assert.equal(items[1].record_state, "active");
  assert.equal(items[1].access_mode, "read_only");
  assert.equal(items[1].isRuntimeAttached, false);
});

test("projectSessionListItems shows detached active history as read-only instead of running", () => {
  const [item] = projectSessionListItems({
    sessions: [],
    archivedSessions: [{
      id: "history-running",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
      record_state: "active",
      access_mode: "interactive",
      turns: [{
        id: "turn-1",
        status: "running",
        state: 2,
        finalResponse: "saved answer",
        outputs: [],
        logs: [],
      }],
    }],
    createRuntimeBinding: () => ({ state: "idle" }),
    constants: {
      RECORD_STATE: { active: "active", archived: "archived" },
      ACCESS_MODE: { read_only: "read_only" },
    },
  });

  assert.equal(item.record_state, "active");
  assert.equal(item.access_mode, "read_only");
  assert.equal(item.isRuntimeAttached, false);
  assert.equal(item.turns[0].status, "completed");
});

test("projectSessionListItems prefers disk history over an inactive hidden memory shell", () => {
  const staleMemorySession = {
    id: "same-session",
    createdAt: "2026-06-08T00:00:00.000Z",
    task: "旧内存状态",
    lifecycle: "live",
    access_mode: "interactive",
    inWorkspace: false,
    turns: [{
      id: "turn-1",
      status: "running",
      state: 2,
      outputs: [],
      logs: [],
    }],
  };
  const [item] = projectSessionListItems({
    sessions: [staleMemorySession],
    archivedSessions: [{
      id: "same-session",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:01:00.000Z",
      title: "磁盘历史",
      record_state: "active",
      turns: [{
        id: "turn-1",
        status: "completed",
        state: 5,
        finalResponse: "已保存结果",
        outputs: [],
        logs: [],
      }],
    }],
    isSessionActive: () => false,
    normalizeSession: (session) => session,
    sessionRuntimeState: (session) => session.lifecycle,
    createRuntimeBinding: () => ({ state: "idle" }),
    constants: {
      RECORD_STATE: { active: "active", archived: "archived" },
      ACCESS_MODE: { read_only: "read_only" },
    },
  });

  assert.equal(item.title, "磁盘历史");
  assert.equal(item.access_mode, "read_only");
  assert.equal(item.isRuntimeAttached, false);
  assert.equal(item.turns[0].status, "completed");
});

test("projectSessionListItems keeps a hidden memory session authoritative while runtime remains active", () => {
  const [item] = projectSessionListItems({
    sessions: [{
      id: "live-hidden",
      createdAt: "2026-06-08T00:00:00.000Z",
      task: "仍在执行",
      lifecycle: "live",
      access_mode: "interactive",
      inWorkspace: false,
      turns: [{ id: "turn-1", status: "running", state: 2 }],
    }],
    archivedSessions: [{
      id: "live-hidden",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:01:00.000Z",
      title: "旧磁盘快照",
    }],
    isSessionActive: () => true,
    normalizeSession: (session) => session,
    sessionRuntimeState: (session) => session.lifecycle,
    constants: {
      RECORD_STATE: { active: "active", archived: "archived" },
      ACCESS_MODE: { read_only: "read_only" },
    },
  });

  assert.equal(item.title, "仍在执行");
  assert.equal(item.access_mode, "interactive");
  assert.equal(item.isRuntimeAttached, true);
});

test("session list sectioning treats read-only as access mode, not archive state", () => {
  const readOnlyActive = item("readonly-active", {
    record_state: "active",
    access_mode: "read_only",
  });
  const archivedInteractive = item("archived-interactive", {
    record_state: "archived",
    access_mode: "interactive",
  });

  assert.equal(isActiveSessionListItem(readOnlyActive), true);
  assert.equal(isArchivedSessionListItem(readOnlyActive), false);
  assert.equal(isActiveSessionListItem(archivedInteractive), false);
  assert.equal(isArchivedSessionListItem(archivedInteractive), true);
});
