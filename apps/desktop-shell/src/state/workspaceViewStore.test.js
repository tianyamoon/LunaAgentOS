import test from "node:test";
import assert from "node:assert/strict";
import { WORKSPACE_VIEW_MODE, createWorkspaceViewStore } from "./workspaceViewStore.js";

test("workspaceViewStore: toggleFocus enters focused mode", () => {
  const store = createWorkspaceViewStore();
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.grid);
  assert.equal(store.toggleFocus("a"), true);
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.focused);
  assert.equal(store.getFocusedSessionId(), "a");
});

test("workspaceViewStore: activateSession switches focused session only in focused mode", () => {
  const store = createWorkspaceViewStore({ mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" });
  assert.equal(store.activateSession("b"), true);
  assert.equal(store.getFocusedSessionId(), "b");
});

test("workspaceViewStore: activateSession does not enter focused mode from grid", () => {
  const store = createWorkspaceViewStore();
  assert.equal(store.activateSession("b"), false);
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.grid);
  assert.equal(store.getFocusedSessionId(), null);
});

test("workspaceViewStore: toggleFocus exits when toggling the focused session", () => {
  const store = createWorkspaceViewStore({ mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" });
  assert.equal(store.toggleFocus("a"), true);
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.grid);
  assert.equal(store.getFocusedSessionId(), null);
});

test("workspaceViewStore: exitFocus clears focused mode", () => {
  const store = createWorkspaceViewStore({ mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" });
  assert.equal(store.exitFocus(), true);
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.grid);
  assert.equal(store.getFocusedSessionId(), null);
  assert.equal(store.exitFocus(), false);
});

test("workspaceViewStore: clearIfSessionRemoved clears only the focused session", () => {
  const store = createWorkspaceViewStore({ mode: WORKSPACE_VIEW_MODE.focused, focusedSessionId: "a" });
  assert.equal(store.clearIfSessionRemoved("b"), false);
  assert.equal(store.getFocusedSessionId(), "a");
  assert.equal(store.clearIfSessionRemoved("a"), true);
  assert.equal(store.getFocusedSessionId(), null);
});

test("workspaceViewStore: hydrateFromSessions migrates legacy fullscreen state", () => {
  const store = createWorkspaceViewStore();
  assert.equal(store.hydrateFromSessions([{ id: "a" }, { id: "b", fullscreen: true }]), true);
  assert.equal(store.getMode(), WORKSPACE_VIEW_MODE.focused);
  assert.equal(store.getFocusedSessionId(), "b");
});

test("workspaceViewStore: subscribe notifies only on real changes", () => {
  const store = createWorkspaceViewStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.focusSession("a");
  store.focusSession("a");
  store.activateSession("b");
  store.exitFocus();
  assert.equal(notifyCount, 3);
});
