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

test("compareActiveSessionListItems ignores isInWorkspace so toggling workspace membership never reorders", () => {
  const olderInWorkspace = item("older-workspace", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
    isInWorkspace: true,
  });
  const newerDismissed = item("newer-dismissed", {
    createdAt: "2026-05-03T00:00:00.000Z",
    updatedAt: "2026-05-03T00:00:00.000Z",
    isInWorkspace: false,
  });

  // Newer item stays on top regardless of workspace membership; toggling
  // isInWorkspace on either side does not move them around.
  assert.deepEqual(
    [olderInWorkspace, newerDismissed].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer-dismissed", "older-workspace"],
  );

  olderInWorkspace.isInWorkspace = false;
  newerDismissed.isInWorkspace = true;

  assert.deepEqual(
    [olderInWorkspace, newerDismissed].sort(compareActiveSessionListItems).map((entry) => entry.id),
    ["newer-dismissed", "older-workspace"],
  );
});

test("compareArchivedSessionListItems sorts archived history by createdAt and ignores updatedAt churn", () => {
  const older = item("older", {
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-05T00:00:00.000Z", // bumped later by recent activity
  });
  const newer = item("newer", {
    createdAt: "2026-05-02T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  });

  assert.deepEqual(
    [older, newer].sort(compareArchivedSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );

  // Bumping updatedAt later does not push the older row past the newer one.
  older.updatedAt = "2030-01-01T00:00:00.000Z";
  assert.deepEqual(
    [older, newer].sort(compareArchivedSessionListItems).map((entry) => entry.id),
    ["newer", "older"],
  );
});
