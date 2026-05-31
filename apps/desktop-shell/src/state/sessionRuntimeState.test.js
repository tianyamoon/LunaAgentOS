import test from "node:test";
import assert from "node:assert/strict";
import { createSessionsStore } from "./sessionsStore.js";
import { LIFECYCLE } from "./sessionLifecycle.js";
import {
  ACCESS_MODE,
  RECORD_STATE,
  RUNTIME_BINDING_STAGE,
  RUNTIME_BINDING_STATE,
} from "./sessionStatus.js";
import { createSessionRuntimeState } from "./sessionRuntimeState.js";

function makeRuntimeState() {
  const sessionsStore = createSessionsStore();
  const errors = [];
  const runtimeState = createSessionRuntimeState({
    sessionsStore,
    logger: { error: (...args) => errors.push(args) },
  });
  return { errors, runtimeState, sessionsStore };
}

function makeSession(id = "session-1", overrides = {}) {
  return {
    id,
    lifecycle: LIFECYCLE.live,
    runtimeState: LIFECYCLE.live,
    turns: [],
    ...overrides,
  };
}

test("sessionRuntimeState: legacy tombstones determine lifecycle", () => {
  const { runtimeState, sessionsStore } = makeRuntimeState();
  const session = makeSession("legacy", { lifecycle: null, runtimeState: LIFECYCLE.live });
  sessionsStore.markStopped(session.id);
  assert.equal(runtimeState.sessionLifecycle(session), LIFECYCLE.stopped);
  sessionsStore.markDeleted(session.id);
  assert.equal(runtimeState.sessionLifecycle(session), LIFECYCLE.deleted);
});

test("sessionRuntimeState: restoring transition updates record and binding", () => {
  const { runtimeState } = makeRuntimeState();
  const session = makeSession("archived", {
    lifecycle: LIFECYCLE.archived,
    runtimeState: LIFECYCLE.archived,
    record_state: RECORD_STATE.archived,
  });
  assert.equal(runtimeState.setSessionLifecycle(session, LIFECYCLE.restoring), LIFECYCLE.restoring);
  assert.equal(session.record_state, RECORD_STATE.active);
  assert.equal(session.runtime_binding.state, RUNTIME_BINDING_STATE.reconnecting);
  assert.equal(session.runtime_binding.stage, RUNTIME_BINDING_STAGE.load);
});

test("sessionRuntimeState: stopped and deleted transitions sync tombstones", () => {
  const { runtimeState, sessionsStore } = makeRuntimeState();
  const stopped = makeSession("stopped");
  runtimeState.setSessionLifecycle(stopped, LIFECYCLE.stopped);
  assert.equal(sessionsStore.isSessionStopped(stopped.id), true);
  runtimeState.setSessionLifecycle(stopped, LIFECYCLE.archived);
  assert.equal(sessionsStore.isSessionStopped(stopped.id), false);

  const deleted = makeSession("deleted");
  runtimeState.setSessionLifecycle(deleted, LIFECYCLE.deleted);
  assert.equal(sessionsStore.isSessionDeleted(deleted.id), true);
  assert.equal(deleted.record_state, RECORD_STATE.deleted);
});

test("sessionRuntimeState: invalid transition is logged and ignored", () => {
  const { errors, runtimeState } = makeRuntimeState();
  const session = makeSession("archived", {
    lifecycle: LIFECYCLE.archived,
    runtimeState: LIFECYCLE.archived,
  });
  assert.equal(runtimeState.setSessionLifecycle(session, LIFECYCLE.live), LIFECYCLE.archived);
  assert.equal(session.lifecycle, LIFECYCLE.archived);
  assert.equal(errors.length, 1);
});

test("sessionRuntimeState: binding cleanup and sendability share one shape", () => {
  const { runtimeState } = makeRuntimeState();
  const session = makeSession("sendable");
  runtimeState.setSessionRecordState(session, RECORD_STATE.active);
  runtimeState.setSessionAccessMode(session, ACCESS_MODE.interactive);
  runtimeState.setRuntimeBinding(session, {
    state: RUNTIME_BINDING_STATE.failed,
    stage: RUNTIME_BINDING_STAGE.prompt,
    error_detail: "boom",
  });
  assert.equal(runtimeState.canSendToSession(session), false);
  runtimeState.clearRuntimeBindingError(session);
  assert.equal(runtimeState.canSendToSession(session), true);
  assert.equal(session.runtime_binding.state, RUNTIME_BINDING_STATE.connected);
  assert.equal(session.runtime_binding.error_detail, null);
});

test("sessionRuntimeState: archived ACP sessions are restorable", () => {
  const { runtimeState } = makeRuntimeState();
  const session = makeSession("archived", {
    acpSessionId: "acp-1",
    lifecycle: LIFECYCLE.archived,
    runtimeState: LIFECYCLE.archived,
    record_state: RECORD_STATE.archived,
    access_mode: ACCESS_MODE.read_only,
  });
  assert.equal(runtimeState.canRestoreSession(session), true);
});
