import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceView } from "./workspaceView.js";

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    toggle(value, force) {
      if (force === undefined) {
        if (values.has(value)) {
          values.delete(value);
          return false;
        }
        values.add(value);
        return true;
      }
      if (force) values.add(value);
      else values.delete(value);
      return force;
    },
    contains(value) {
      return values.has(value);
    },
  };
}

test("workspaceView: reconnecting current session marks the shell and workspace panel as restoring", async () => {
  const appShell = { classList: createClassList() };
  const panel = { classList: createClassList() };
  const sessionDeck = {
    scrollLeft: 0,
    scrollTop: 0,
    classList: createClassList(),
    innerHTML: "",
    closest: (selector) => {
      if (selector === ".workspace-panel") return panel;
      if (selector === ".app-shell") return appShell;
      return null;
    },
    querySelector: () => null,
  };
  const workspaceEmpty = { style: { display: "" } };
  const sessions = [{
    id: "session-a",
    title: "restore session",
    createdAt: "2026-06-23T00:00:00.000Z",
    turns: [],
    runtime_binding: { state: "reconnecting", stage: "load" },
  }];
  const workspaceViewStore = {
    getFocusedSessionId: () => null,
    clearIfSessionRemoved: () => {},
  };
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => {
    callback();
    return 0;
  };

  try {
    const view = createWorkspaceView({
      sessionDeck,
      workspaceEmpty,
      getSessionsSnapshot: () => sessions,
      workspaceViewStore,
      updatePromptPlaceholder: () => {},
      renderWorkspaceStatus: () => {},
      renderWorkspaceEmptyCopy: () => {},
      renderSessionCard: () => "<article class=\"session-card\"></article>",
      renderSessionMiniCard: () => "",
      bindSessionActions: () => {},
      renderMermaidDiagrams: () => Promise.resolve(),
      sampleSessionStickyIntent: () => new Map(),
      syncSessionStickControllers: () => {},
      getCurrentSessionId: () => "session-a",
      t: (key) => key,
      escapeHtml: (value) => String(value ?? ""),
    });

    view.renderWorkspace();
    await Promise.resolve();
    assert.equal(appShell.classList.contains("is-restoring"), true);
    assert.equal(panel.classList.contains("is-restoring"), true);
  } finally {
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
  }
});
