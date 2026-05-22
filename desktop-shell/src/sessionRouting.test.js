import test from "node:test";
import assert from "node:assert/strict";
import {
  currentSessionForTarget,
  shouldBlockSendForCurrentSession,
  shouldClearCurrentSessionForTarget,
} from "./sessionRouting.js";

test("clears current session when send target changes to another agent", () => {
  const hermesSession = { id: "session-hermes", agentId: "hermes-wsl:profile:default", runtimeState: "live" };

  assert.equal(shouldClearCurrentSessionForTarget(hermesSession, "claude-win"), true);
  assert.equal(currentSessionForTarget(hermesSession, "claude-win"), null);
});

test("keeps current session when send target still matches", () => {
  const hermesSession = { id: "session-hermes", agentId: "hermes-wsl:profile:default", runtimeState: "live" };

  assert.equal(shouldClearCurrentSessionForTarget(hermesSession, "hermes-wsl:profile:default"), false);
  assert.equal(currentSessionForTarget(hermesSession, "hermes-wsl:profile:default"), hermesSession);
});

test("blocks default send into a non-live current session", () => {
  const failedSession = { id: "session-hermes", agentId: "hermes-wsl:profile:default", runtimeState: "resume_failed" };

  assert.equal(shouldBlockSendForCurrentSession({
    currentSession: failedSession,
    targetId: "hermes-wsl:profile:default",
  }), true);
});

test("allows explicit new-session send when current session is non-live", () => {
  const failedSession = { id: "session-hermes", agentId: "hermes-wsl:profile:default", runtimeState: "resume_failed" };

  assert.equal(shouldBlockSendForCurrentSession({
    currentSession: failedSession,
    targetId: "hermes-wsl:profile:default",
    forceNewSession: true,
  }), false);
});

test("does not block when the selected current session is live", () => {
  const liveSession = { id: "session-hermes", agentId: "hermes-wsl:profile:default", runtimeState: "live" };

  assert.equal(shouldBlockSendForCurrentSession({
    currentSession: liveSession,
    targetId: "hermes-wsl:profile:default",
  }), false);
});
