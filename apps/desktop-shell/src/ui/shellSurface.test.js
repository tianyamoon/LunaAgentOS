import test from "node:test";
import assert from "node:assert/strict";

import { createShellSurface } from "./shellSurface.js";

test("shellSurface: 按刷新意图调用对应 View seam", () => {
  const calls = [];
  const surface = createShellSurface({
    renderProviders: () => calls.push(["providers"]),
    renderWorkspace: (options = {}) => calls.push(["workspace", options]),
    renderHistory: (options = {}) => calls.push(["history", options]),
    renderWorkspaceStatus: () => calls.push(["workspace-status"]),
    renderWorkspaceEmptyCopy: () => calls.push(["workspace-empty"]),
    updateActionLabels: () => calls.push(["actions"]),
    focusComposerInput: () => calls.push(["focus"]),
  });

  surface.refresh({
    actions: true,
    providers: true,
    workspaceStatus: true,
    workspaceEmpty: true,
    workspace: true,
    workspaceOptions: { focusSessionId: "s1" },
    history: true,
    historyOptions: { scrollSessionId: "s1" },
    focusComposer: true,
  });

  assert.deepEqual(calls, [
    ["actions"],
    ["providers"],
    ["workspace-status"],
    ["workspace-empty"],
    ["workspace", { focusSessionId: "s1" }],
    ["history", { scrollSessionId: "s1" }],
    ["focus"],
  ]);
});

test("shellSurface: 单点刷新方法保持窄接口", () => {
  const calls = [];
  const surface = createShellSurface({
    renderWorkspace: (options = {}) => calls.push(["workspace", options]),
    renderHistory: (options = {}) => calls.push(["history", options]),
  });

  surface.refreshWorkspace({ focusSessionId: "a" });
  surface.refreshHistory({ scrollSessionId: "a" });

  assert.deepEqual(calls, [
    ["workspace", { focusSessionId: "a" }],
    ["history", { scrollSessionId: "a" }],
  ]);
});
