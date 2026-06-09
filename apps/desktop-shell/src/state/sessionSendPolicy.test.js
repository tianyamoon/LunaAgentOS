import test from "node:test";
import assert from "node:assert/strict";

import { currentSessionSendBlockReason } from "./sessionSendPolicy.js";

const t = (key) => key;
const agent = { id: "agent-a" };

test("sessionSendPolicy: sendable current session is not blocked", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-a" }, agent, {
    canSendToSession: () => true,
    canRestoreSession: () => false,
    translate: t,
  });

  assert.equal(reason, "");
});

test("sessionSendPolicy: read-only history points to restore when restorable", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-a", access_mode: "read_only" }, agent, {
    canSendToSession: () => false,
    canRestoreSession: () => true,
    translate: t,
  });

  assert.equal(reason, "session.readOnlySwitchBlocked");
});

test("sessionSendPolicy: read-only history without runtime identity points to new session", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-a", access_mode: "read_only" }, agent, {
    canSendToSession: () => false,
    canRestoreSession: () => false,
    translate: t,
  });

  assert.equal(reason, "session.readOnlyCannotRestore");
});

test("sessionSendPolicy: failed restorable live session requires restore instead of silent send", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-a", access_mode: "interactive" }, agent, {
    canSendToSession: () => false,
    canRestoreSession: () => true,
    translate: t,
  });

  assert.equal(reason, "session.notSendableRestoreRequired");
});

test("sessionSendPolicy: failed unrestorable live session requires explicit new session", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-a", access_mode: "interactive" }, agent, {
    canSendToSession: () => false,
    canRestoreSession: () => false,
    translate: t,
  });

  assert.equal(reason, "session.notSendableStartNewRequired");
});

test("sessionSendPolicy: target mismatch keeps inactive-session wording", () => {
  const reason = currentSessionSendBlockReason({ id: "s1", agentId: "agent-b" }, agent, {
    canSendToSession: () => true,
    translate: t,
  });

  assert.equal(reason, "composer.blockInactiveSession");
});
