import test from "node:test";
import assert from "node:assert/strict";
import {
  compareActiveSessionListItems,
  compareArchivedSessionListItems,
} from "./sessionListItems.js";

function item(id, overrides = {}) {
  return {
    id,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    isInWorkspace: true,
    ...overrides,
  };
}

test("compareActiveSessionListItems keeps workspace sessions ordered by createdAt, not updatedAt", () => {
  const olderButRecentlyUpdated = item("older", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
  });
  const newerButQuiet = item("newer", {
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(
    [olderButRecentlyUpdated, newerButQuiet].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );
});

test("compareActiveSessionListItems keeps workspace rows before history-only active rows", () => {
  const historyOnly = item("history-only", {
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    isInWorkspace: false,
  });
  const workspace = item("workspace", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    isInWorkspace: true,
  });

  assert.deepEqual(
    [historyOnly, workspace].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["workspace", "history-only"],
  );
});

test("compareArchivedSessionListItems keeps archived history sorted by updatedAt", () => {
  const older = item("older", { updatedAt: "2026-05-01T00:00:00.000Z" });
  const newer = item("newer", { updatedAt: "2026-05-02T00:00:00.000Z" });

  assert.deepEqual(
    [older, newer].sort(compareArchivedSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );
});
