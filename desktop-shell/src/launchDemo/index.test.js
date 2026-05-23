import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLaunchDemoHistoryEntries,
  buildLaunchDemoSessions,
  createDemoTurn,
  demoTimestamp,
  isDemoSession,
  isDemoSessionId,
} from "./index.js";
import { LIFECYCLE } from "../state/sessionLifecycle.js";

test("demoTimestamp returns an ISO string in the past", () => {
  const ts = demoTimestamp(60);
  const parsed = new Date(ts).getTime();
  assert.ok(parsed < Date.now());
  assert.match(ts, /\dT\d/);
});

test("createDemoTurn assembles a turn with outputs == [finalResponse]", () => {
  const turn = createDemoTurn("turn-1", "task", 5, ["thought"], "final response", ["log"], 5);
  assert.equal(turn.id, "turn-1");
  assert.equal(turn.task, "task");
  assert.equal(turn.state, 5);
  assert.deepEqual(turn.thoughts, ["thought"]);
  assert.equal(turn.finalResponse, "final response");
  assert.deepEqual(turn.outputs, ["final response"]);
  assert.deepEqual(turn.logs, ["log"]);
  assert.deepEqual(turn.meta, {});
});

test("createDemoTurn carries meta when provided", () => {
  const meta = { hermesProfile: { profileName: "ai" } };
  const turn = createDemoTurn("turn-2", "task", 3, [], "", [], 1, meta);
  assert.equal(turn.meta, meta);
});

test("isDemoSession identifies demo sessions by id prefix", () => {
  assert.equal(isDemoSession({ id: "demo-session-x" }), true);
  assert.equal(isDemoSession({ id: "session-x" }), false);
  assert.equal(isDemoSession(null), false);
  assert.equal(isDemoSession({}), false);
});

test("isDemoSessionId works on raw strings", () => {
  assert.equal(isDemoSessionId("demo-session-foo"), true);
  assert.equal(isDemoSessionId("foo"), false);
  assert.equal(isDemoSessionId(null), false);
});

test("buildLaunchDemoSessions returns Hermes + Claude both lifecycle live", () => {
  const sessions = buildLaunchDemoSessions();
  assert.equal(sessions.length, 2);
  const hermes = sessions.find((s) => s.id === "demo-session-hermes-live");
  const claude = sessions.find((s) => s.id === "demo-session-claude-review");
  assert.ok(hermes);
  assert.ok(claude);
  assert.equal(hermes.lifecycle, LIFECYCLE.live);
  assert.equal(claude.lifecycle, LIFECYCLE.live);
  assert.equal(hermes.runtimeState, LIFECYCLE.live);
  assert.equal(claude.runtimeState, LIFECYCLE.live);
});

test("buildLaunchDemoSessions Hermes session carries profile metadata", () => {
  const [hermes] = buildLaunchDemoSessions();
  assert.equal(hermes.profileName, "ailearning");
  assert.equal(hermes.profileExecutable, "ailearning");
  assert.equal(hermes.profileModel, "MiniMax M2");
  assert.equal(hermes.skillCount, 4);
  assert.equal(hermes.hasSoul, true);
});

test("buildLaunchDemoHistoryEntries returns a schema-versioned archive entry", () => {
  const [entry] = buildLaunchDemoHistoryEntries(3);
  assert.equal(entry.schema_version, 3);
  assert.equal(entry.id, "demo-history-roadmap");
  assert.equal(entry.session_id, "demo-session-archive-roadmap");
  assert.equal(entry.provider_id, "claude");
  assert.ok(entry.turn);
  assert.equal(entry.turn.id, "demo-turn-archive-roadmap");
});
