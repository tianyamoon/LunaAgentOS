import test from "node:test";
import assert from "node:assert/strict";
import {
  LIFECYCLE,
  InvalidLifecycleTransition,
  canTransition,
  nextLifecycle,
  isLiveLifecycle,
  isArchivedLifecycle,
  isTerminalLifecycle,
  canSendLifecycle,
  canRestoreLifecycle,
  isRestoringLifecycle,
  isStoppedLifecycle,
  isDeletedLifecycle,
  lifecycleFromLegacy,
} from "./sessionLifecycle.js";

test("draft can transition to live", () => {
  assert.equal(canTransition("draft", "live"), true);
});

test("live -> archived is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.live, LIFECYCLE.archived), true);
});

test("live -> stopped is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.live, LIFECYCLE.stopped), true);
});

test("live -> resume_failed is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.live, LIFECYCLE.resume_failed), true);
});

test("archived -> restoring is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.archived, LIFECYCLE.restoring), true);
});

test("archived -> live directly is NOT allowed (must go through restoring)", () => {
  assert.equal(canTransition(LIFECYCLE.archived, LIFECYCLE.live), false);
});

test("restoring -> live is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.restoring, LIFECYCLE.live), true);
});

test("restoring -> archived (no commands) is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.restoring, LIFECYCLE.archived), true);
});

test("restoring -> resume_failed is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.restoring, LIFECYCLE.resume_failed), true);
});

test("resume_failed -> restoring (retry) is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.resume_failed, LIFECYCLE.restoring), true);
});

test("resume_failed -> archived is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.resume_failed, LIFECYCLE.archived), true);
});

test("resume_failed -> live directly is NOT allowed", () => {
  assert.equal(canTransition(LIFECYCLE.resume_failed, LIFECYCLE.live), false);
});

test("stopped -> archived is allowed", () => {
  assert.equal(canTransition(LIFECYCLE.stopped, LIFECYCLE.archived), true);
});

test("stopped -> live is NOT allowed (no resume path defined yet)", () => {
  assert.equal(canTransition(LIFECYCLE.stopped, LIFECYCLE.live), false);
});

test("deleted is terminal: no outgoing transitions", () => {
  for (const target of Object.values(LIFECYCLE)) {
    if (target === LIFECYCLE.deleted) continue;
    assert.equal(canTransition(LIFECYCLE.deleted, target), false, `deleted -> ${target} should be blocked`);
  }
});

test("any state can self-loop (idempotent)", () => {
  for (const state of Object.values(LIFECYCLE)) {
    assert.equal(canTransition(state, state), true, `${state} -> ${state} should be a no-op`);
  }
});

test("any state can transition to deleted", () => {
  for (const state of Object.values(LIFECYCLE)) {
    if (state === LIFECYCLE.deleted) continue;
    assert.equal(canTransition(state, LIFECYCLE.deleted), true, `${state} -> deleted should be allowed`);
  }
});

test("nextLifecycle returns the new state on a legal transition", () => {
  assert.equal(nextLifecycle(LIFECYCLE.archived, LIFECYCLE.restoring), LIFECYCLE.restoring);
});

test("nextLifecycle throws InvalidLifecycleTransition on a bad transition", () => {
  assert.throws(() => nextLifecycle(LIFECYCLE.archived, LIFECYCLE.live), InvalidLifecycleTransition);
});

test("nextLifecycle throws on unknown source", () => {
  assert.throws(() => nextLifecycle("ufo", LIFECYCLE.live), InvalidLifecycleTransition);
});

test("predicates classify states correctly", () => {
  assert.equal(isLiveLifecycle(LIFECYCLE.live), true);
  assert.equal(isLiveLifecycle(LIFECYCLE.restoring), false);

  assert.equal(isArchivedLifecycle(LIFECYCLE.archived), true);
  assert.equal(isArchivedLifecycle(LIFECYCLE.resume_failed), true);
  assert.equal(isArchivedLifecycle(LIFECYCLE.live), false);

  assert.equal(canSendLifecycle(LIFECYCLE.live), true);
  assert.equal(canSendLifecycle(LIFECYCLE.archived), false);
  assert.equal(canSendLifecycle(LIFECYCLE.restoring), false);

  assert.equal(canRestoreLifecycle(LIFECYCLE.archived), true);
  assert.equal(canRestoreLifecycle(LIFECYCLE.resume_failed), true);
  assert.equal(canRestoreLifecycle(LIFECYCLE.live), false);

  assert.equal(isRestoringLifecycle(LIFECYCLE.restoring), true);
  assert.equal(isStoppedLifecycle(LIFECYCLE.stopped), true);
  assert.equal(isDeletedLifecycle(LIFECYCLE.deleted), true);
  assert.equal(isTerminalLifecycle(LIFECYCLE.deleted), true);
  assert.equal(isTerminalLifecycle(LIFECYCLE.archived), false);
});

test("lifecycleFromLegacy: deleted Set wins everything", () => {
  assert.equal(lifecycleFromLegacy({ runtimeState: "live", isStopped: true, isDeleted: true }), LIFECYCLE.deleted);
});

test("lifecycleFromLegacy: stopped Set overrides runtimeState live", () => {
  assert.equal(lifecycleFromLegacy({ runtimeState: "live", isStopped: true }), LIFECYCLE.stopped);
});

test("lifecycleFromLegacy: respects existing runtimeState when no overrides", () => {
  assert.equal(lifecycleFromLegacy({ runtimeState: "archived" }), LIFECYCLE.archived);
  assert.equal(lifecycleFromLegacy({ runtimeState: "restoring" }), LIFECYCLE.restoring);
  assert.equal(lifecycleFromLegacy({ runtimeState: "resume_failed" }), LIFECYCLE.resume_failed);
});

test("lifecycleFromLegacy: defaults to live when nothing is known", () => {
  assert.equal(lifecycleFromLegacy({}), LIFECYCLE.live);
  assert.equal(lifecycleFromLegacy({ runtimeState: "totally-unknown" }), LIFECYCLE.live);
});

test("transition complete coverage matrix matches documented map", () => {
  const expected = {
    draft: new Set(["draft", "live", "archived", "deleted"]),
    live: new Set(["live", "archived", "restoring", "resume_failed", "stopped", "deleted"]),
    restoring: new Set(["restoring", "live", "resume_failed", "archived", "deleted"]),
    archived: new Set(["archived", "restoring", "deleted"]),
    resume_failed: new Set(["resume_failed", "restoring", "archived", "deleted"]),
    stopped: new Set(["stopped", "archived", "deleted"]),
    deleted: new Set(["deleted"]),
  };
  for (const [from, allowedSet] of Object.entries(expected)) {
    for (const to of Object.values(LIFECYCLE)) {
      const actual = canTransition(from, to);
      const want = allowedSet.has(to);
      assert.equal(
        actual,
        want,
        `transition ${from} -> ${to} expected ${want} got ${actual}`,
      );
    }
  }
});
