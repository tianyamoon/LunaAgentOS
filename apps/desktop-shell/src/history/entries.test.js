import test from "node:test";
import assert from "node:assert/strict";
import {
  archivedSessionsFromHistory,
  historySessionKey,
  historyTurnKey,
} from "./entries.js";

test("historySessionKey prefers camelCase sessionId, then session_id, then acp ids, then id", () => {
  assert.equal(historySessionKey({ sessionId: "a", id: "z" }), "a");
  assert.equal(historySessionKey({ session_id: "b", id: "z" }), "b");
  assert.equal(historySessionKey({ acpSessionId: "c", id: "z" }), "c");
  assert.equal(historySessionKey({ acp_session_id: "d", id: "z" }), "d");
  assert.equal(historySessionKey({ id: "z" }), "z");
  assert.equal(historySessionKey(null), null);
  assert.equal(historySessionKey({}), null);
});

test("historyTurnKey concatenates session key and turn id", () => {
  assert.equal(historyTurnKey({ sessionId: "s1", turn: { id: "t1" } }), "s1:t1");
  assert.equal(historyTurnKey({ session_id: "s2", id: "t2" }), "s2:t2");
});

test("archivedSessionsFromHistory groups multiple turns under the same session key", () => {
  const entries = [
    { sessionId: "s1", id: "t1", task: "first task", summary: "sum-1", createdAt: "2026-05-01T10:00:00Z", date: "2026-05-01", providerId: "claude", providerName: "Claude Code", agentId: "claude-main", agentName: "Claude / 主会话" },
    { sessionId: "s1", id: "t2", task: "second task", summary: "sum-2", createdAt: "2026-05-01T11:00:00Z", date: "2026-05-01", providerId: "claude", providerName: "Claude Code", agentId: "claude-main", agentName: "Claude / 主会话" },
  ];
  const sessions = archivedSessionsFromHistory(entries);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "s1");
  assert.equal(sessions[0].turnCount, 2);
  assert.equal(sessions[0].summary, "sum-2");
  assert.equal(sessions[0].updatedAt, "2026-05-01T11:00:00Z");
});

test("archivedSessionsFromHistory sorts sessions by updatedAt descending", () => {
  const entries = [
    { sessionId: "older", id: "o1", task: "old", summary: "o", createdAt: "2026-04-01T00:00:00Z" },
    { sessionId: "newer", id: "n1", task: "new", summary: "n", createdAt: "2026-05-01T00:00:00Z" },
  ];
  const sessions = archivedSessionsFromHistory(entries);
  assert.deepEqual(sessions.map((s) => s.id), ["newer", "older"]);
});

test("archivedSessionsFromHistory tolerates snake_case keys and provides defaults", () => {
  const entries = [
    {
      session_id: "s2",
      id: "t1",
      task: "snake",
      summary: "ok",
      created_at: "2026-05-02T00:00:00Z",
      date: "2026-05-02",
      provider_id: "hermes",
      provider_name: "Hermes",
      agent_id: "hermes-ailearning",
      agent_name: "Hermes / ailearning",
      acp_session_id: "acp-x",
      runtime_instance_id: "rt-1",
      runtime_label: "WSL",
      runtime_host: "wsl",
      runtime_command: "cmd",
      record_state: "archived",
      access_mode: "read_only",
      runtime_binding: { state: "failed", stage: "resume" },
    },
  ];
  const [session] = archivedSessionsFromHistory(entries);
  assert.equal(session.id, "s2");
  assert.equal(session.providerId, "hermes");
  assert.equal(session.providerName, "Hermes");
  assert.equal(session.agentId, "hermes-ailearning");
  assert.equal(session.acpSessionId, "acp-x");
  assert.equal(session.runtimeInstanceId, "rt-1");
  assert.equal(session.runtimeHost, "wsl");
  assert.equal(session.runtimeCommand, "cmd");
  assert.equal(session.record_state, "archived");
  assert.equal(session.access_mode, "read_only");
  assert.deepEqual(session.runtime_binding, { state: "failed", stage: "resume" });
});

test("archivedSessionsFromHistory synthesizes a turn when entry.turn is absent", () => {
  const entries = [
    { sessionId: "s1", id: "t1", task: "no turn", summary: "auto", createdAt: "2026-05-01T00:00:00Z" },
  ];
  const [session] = archivedSessionsFromHistory(entries);
  assert.equal(session.turns.length, 1);
  assert.equal(session.turns[0].id, "t1");
  assert.equal(session.turns[0].finalResponse, "auto");
  assert.equal(session.turns[0].status, "completed");
  assert.deepEqual(session.turns[0].thoughts, []);
});

test("archivedSessionsFromHistory invokes the normalizeSession callback per session", () => {
  const entries = [
    { sessionId: "s1", id: "t1", task: "foo", summary: "x", createdAt: "2026-05-01T00:00:00Z" },
  ];
  let calls = 0;
  const sessions = archivedSessionsFromHistory(entries, {
    normalizeSession: (session) => {
      calls += 1;
      return { ...session, normalized: true };
    },
  });
  assert.equal(calls, 1);
  assert.equal(sessions[0].normalized, true);
});

test("archivedSessionsFromHistory returns empty when input is null/undefined", () => {
  assert.deepEqual(archivedSessionsFromHistory(null), []);
  assert.deepEqual(archivedSessionsFromHistory(undefined), []);
  assert.deepEqual(archivedSessionsFromHistory([]), []);
});

test("archivedSessionsFromHistory carries hermesProfile from the first entry that has it", () => {
  const entries = [
    { sessionId: "s1", id: "t1", task: "a", createdAt: "2026-05-01T00:00:00Z" },
    {
      sessionId: "s1",
      id: "t2",
      task: "b",
      createdAt: "2026-05-01T01:00:00Z",
      turn: { id: "t2", createdAt: "2026-05-01T01:00:00Z", meta: { hermesProfile: { profileName: "ai" } } },
    },
  ];
  const [session] = archivedSessionsFromHistory(entries);
  assert.deepEqual(session.hermesProfile, { profileName: "ai" });
});

test("archivedSessionsFromHistory carries agentEntrySnapshot from the first entry that has it", () => {
  const snapshot = { agentId: "demo-main", identityKeys: ["demo-main"] };
  const entries = [
    { sessionId: "s1", id: "t1", task: "a", createdAt: "2026-05-01T00:00:00Z" },
    {
      sessionId: "s1",
      id: "t2",
      task: "b",
      createdAt: "2026-05-01T01:00:00Z",
      agentEntrySnapshot: snapshot,
    },
  ];
  const [session] = archivedSessionsFromHistory(entries);
  assert.deepEqual(session.agentEntrySnapshot, snapshot);
});
