import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceEmptyView } from "./workspaceEmptyView.js";
import { ACCESS_MODE, RECORD_STATE } from "../state/sessionStatus.js";

function createElementStub({ missingChildren = false } = {}) {
  const title = { textContent: "", dataset: {} };
  const text = { textContent: "", dataset: {} };
  return {
    title,
    text,
    querySelector(selector) {
      if (missingChildren) return null;
      if (selector === "strong") return title;
      if (selector === "p") return text;
      return null;
    },
  };
}

test("workspaceEmptyView: 有可恢复活跃历史时使用恢复提示", () => {
  const element = createElementStub();
  const view = createWorkspaceEmptyView({
    element,
    getSessionsSnapshot: () => [{ id: "live-a" }],
    getArchivedSessions: () => [
      { id: "live-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.interactive },
      { id: "restore-a", record_state: RECORD_STATE.active, access_mode: ACCESS_MODE.interactive },
    ],
    t: (key) => `t:${key}`,
  });

  view.renderWorkspaceEmptyCopy();

  assert.equal(element.title.textContent, "t:workspace.emptyRestoreTitle");
  assert.equal(element.text.textContent, "t:workspace.emptyRestoreText");
  assert.equal(element.title.dataset.i18n, "workspace.emptyRestoreTitle");
  assert.equal(element.text.dataset.i18n, "workspace.emptyRestoreText");
});

test("workspaceEmptyView: 缺少空态子节点时安全跳过", () => {
  const element = createElementStub({ missingChildren: true });
  const view = createWorkspaceEmptyView({
    element,
    getSessionsSnapshot: () => [],
    getArchivedSessions: () => [],
    t: (key) => key,
  });

  assert.doesNotThrow(() => view.renderWorkspaceEmptyCopy());
});
