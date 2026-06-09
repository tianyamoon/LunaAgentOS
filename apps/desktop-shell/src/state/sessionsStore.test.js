import test from "node:test";
import assert from "node:assert/strict";
import { createSessionsStore } from "./sessionsStore.js";

function makeSession(id, overrides = {}) {
  return { id, task: `task-${id}`, turns: [], ...overrides };
}

test("sessionsStore: replaceSessions copies the array (no aliasing)", () => {
  const store = createSessionsStore();
  const input = [makeSession("a"), makeSession("b")];
  store.replaceSessions(input);
  assert.deepEqual(store.getSessionsSnapshot().map((s) => s.id), ["a", "b"]);
  input.push(makeSession("c"));
  // Mutating the caller's array must not leak into store.
  assert.deepEqual(store.getSessionsSnapshot().map((s) => s.id), ["a", "b"]);
});

test("sessionsStore: getSessionsSnapshot returns an isolated array", () => {
  const store = createSessionsStore();
  store.replaceSessions([makeSession("a")]);
  const snapshot = store.getSessionsSnapshot();
  snapshot.push(makeSession("hacked"));
  assert.deepEqual(store.getSessionsSnapshot().map((session) => session.id), ["a"]);
});

test("sessionsStore: upsertHead inserts at front and dedupes by id", () => {
  const store = createSessionsStore();
  store.replaceSessions([makeSession("a"), makeSession("b")]);
  store.upsertHead(makeSession("c"));
  assert.deepEqual(store.getSessionsSnapshot().map((s) => s.id), ["c", "a", "b"]);
  store.upsertHead(makeSession("a", { task: "updated" }));
  assert.deepEqual(store.getSessionsSnapshot().map((s) => s.id), ["a", "c", "b"]);
  assert.equal(store.getSession("a").task, "updated");
});

test("sessionsStore: removeSessionById and filterSessions only notify on change", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.replaceSessions([makeSession("a"), makeSession("b")]);
  notifyCount = 0;
  store.removeSessionById("missing");
  assert.equal(notifyCount, 0);
  store.removeSessionById("a");
  assert.equal(notifyCount, 1);
  store.filterSessions(() => true);
  assert.equal(notifyCount, 1);
  store.filterSessions((session) => session.id !== "b");
  assert.equal(notifyCount, 2);
  assert.equal(store.getSessionsSnapshot().length, 0);
});

test("sessionsStore: workspace visibility uses an explicit mutation interface", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.replaceSessions([makeSession("a")]);
  notifyCount = 0;
  assert.equal(store.setWorkspaceVisibility("a", false), true);
  assert.equal(store.getSession("a").inWorkspace, false);
  assert.equal(notifyCount, 1);
  assert.equal(store.setWorkspaceVisibility("a", false), false);
  assert.equal(notifyCount, 1);
  assert.equal(store.setWorkspaceVisibility("missing", true), false);
});

test("sessionsStore: updateSession owns object mutation and notifies once", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.replaceSessions([makeSession("a")]);
  notifyCount = 0;

  assert.equal(
    store.updateSession("a", (session) => {
      session.task = "updated";
      return true;
    }),
    true,
  );
  assert.equal(store.getSession("a").task, "updated");
  assert.equal(notifyCount, 1);

  assert.equal(
    store.updateSession("a", () => false),
    false,
  );
  assert.equal(notifyCount, 1);
  assert.equal(store.updateSession("missing", () => true), false);
  assert.equal(notifyCount, 1);
});

test("sessionsStore: currentSessionId clear on demand", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.setCurrentSessionId("a");
  assert.equal(store.getCurrentSessionId(), "a");
  // Setting same value should not notify.
  store.setCurrentSessionId("a");
  assert.equal(notifyCount, 1);
  store.clearCurrentSessionIf("nope");
  assert.equal(store.getCurrentSessionId(), "a");
  store.clearCurrentSessionIf("a");
  assert.equal(store.getCurrentSessionId(), null);
  assert.equal(notifyCount, 2);
});

test("sessionsStore: tombstones and active set are independent", () => {
  const store = createSessionsStore();
  store.markActive("a");
  store.markStopped("b");
  store.markDeleted("c");
  assert.ok(store.isSessionActive("a"));
  assert.ok(!store.isSessionActive("b"));
  assert.ok(store.isSessionStopped("b"));
  assert.ok(store.isSessionDeleted("c"));
  store.markInactive("a");
  assert.ok(!store.isSessionActive("a"));
  store.unmarkStopped("b");
  assert.ok(!store.isSessionStopped("b"));
});

test("sessionsStore: getActiveSessionIds returns a fresh Set copy", () => {
  const store = createSessionsStore();
  store.markActive("a");
  const snapshot = store.getActiveSessionIds();
  snapshot.add("hacked");
  assert.ok(!store.isSessionActive("hacked"));
});

test("sessionsStore: replaceActiveSessionIds resets the set", () => {
  const store = createSessionsStore();
  store.markActive("a");
  store.markActive("b");
  store.replaceActiveSessionIds(["c", "d", null, ""]);
  assert.ok(!store.isSessionActive("a"));
  assert.ok(store.isSessionActive("c"));
  assert.ok(store.isSessionActive("d"));
  assert.equal(store.getActiveSessionIds().size, 2);
});

test("sessionsStore: latest-only flag toggles per session", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  assert.equal(store.isLatestOnly("a"), false);
  store.setLatestOnly("a", true);
  assert.equal(store.isLatestOnly("a"), true);
  assert.equal(notifyCount, 1);
  store.setLatestOnly("a", true);
  assert.equal(notifyCount, 1);
  store.setLatestOnly("a", false);
  assert.equal(notifyCount, 2);
});

test("sessionsStore: flow detail open default fallback", () => {
  const store = createSessionsStore();
  assert.equal(store.getFlowDetailOpen("turn:logs"), false);
  assert.equal(store.getFlowDetailOpen("turn:logs", true), true);
  store.setFlowDetailOpen("turn:logs", true);
  assert.equal(store.getFlowDetailOpen("turn:logs", false), true);
  store.setFlowDetailOpen("turn:logs", false);
  assert.equal(store.getFlowDetailOpen("turn:logs", true), false);
});

test("sessionsStore: batch coalesces notifications", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.batch(() => {
    store.upsertHead(makeSession("a"));
    store.markActive("a");
    store.setCurrentSessionId("a");
  });
  assert.equal(notifyCount, 1);
});

test("sessionsStore: subscribe returns disposer", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  const off = store.subscribe(() => {
    notifyCount += 1;
  });
  store.markActive("a");
  off();
  store.markActive("b");
  assert.equal(notifyCount, 1);
});

test("sessionsStore: reset clears everything and notifies", () => {
  const store = createSessionsStore();
  let notifyCount = 0;
  store.subscribe(() => {
    notifyCount += 1;
  });
  store.upsertHead(makeSession("a"));
  store.markActive("a");
  store.markStopped("a");
  store.setCurrentSessionId("a");
  notifyCount = 0;
  store.reset();
  assert.equal(store.getSessionsSnapshot().length, 0);
  assert.equal(store.getCurrentSessionId(), null);
  assert.ok(!store.isSessionActive("a"));
  assert.ok(!store.isSessionStopped("a"));
  assert.equal(notifyCount, 1);
});

test("sessionsStore: listener errors are logged but do not break others", () => {
  const store = createSessionsStore();
  let goodNotify = 0;
  const originalError = console.error;
  console.error = () => {};
  try {
    store.subscribe(() => {
      throw new Error("boom");
    });
    store.subscribe(() => {
      goodNotify += 1;
    });
    store.markActive("a");
    assert.equal(goodNotify, 1);
  } finally {
    console.error = originalError;
  }
});
