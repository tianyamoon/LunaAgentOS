import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionCardCounts,
  sessionCardStats,
  sessionTurnVisibility,
  turnResponseText,
} from "./sessionCardView.js";

const translate = (key, params = {}) => `${key}:${params.count ?? ""}`;

test("turnResponseText prefers finalResponse and falls back to joined outputs", () => {
  assert.equal(turnResponseText({ finalResponse: "done", outputs: ["stream"] }), "done");
  assert.equal(turnResponseText({ finalResponse: "", outputs: ["one", "two"] }), "one\n\ntwo");
  assert.equal(turnResponseText({}), "");
});

test("sessionCardCounts summarizes turn thoughts logs and responses", () => {
  const session = {
    turns: [
      { thoughts: ["a", "b"], logs: ["l"], finalResponse: "done", outputs: [] },
      { thoughts: [], logs: ["x", "y"], finalResponse: "", outputs: ["chunk"] },
      { thoughts: null, logs: null, finalResponse: "", outputs: [] },
    ],
  };
  assert.deepEqual(sessionCardCounts(session), { thoughts: 2, logs: 3, responses: 2 });
});

test("sessionCardStats keeps labels outside renderer markup", () => {
  const stats = sessionCardStats({ turns: [{ thoughts: ["a"], logs: [], finalResponse: "done", outputs: [] }] }, translate);
  assert.deepEqual(stats, [
    { key: "thoughts", label: "session.thoughts:1" },
    { key: "responses", label: "session.responses:1" },
  ]);
});

test("sessionTurnVisibility returns latest-only view without mutating turns", () => {
  const turns = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const visible = sessionTurnVisibility({ turns }, true);
  assert.deepEqual(visible.turnEntries.map((entry) => entry.turn.id), ["a", "b", "c"]);
  assert.deepEqual(visible.visibleTurnEntries.map((entry) => entry.turn.id), ["c"]);
  assert.equal(visible.hiddenTurnCount, 2);
  assert.equal(turns.length, 3);
});
