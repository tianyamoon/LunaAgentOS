import test from "node:test";
import assert from "node:assert/strict";
import { createHistoryRepository } from "./historyRepository.js";

// 创建可记录调用顺序的 Repository，便于验证 IO 与快照边界。
function makeRepository({ responses = {}, buildPayload, projectArchivedSessions } = {}) {
  const calls = [];
  const invoke = async (command, args) => {
    calls.push({ command, args });
    const response = responses[command];
    if (response instanceof Error) throw response;
    return typeof response === "function" ? response(args) : response;
  };
  const repository = createHistoryRepository({
    invoke,
    buildPayload: buildPayload || ((value) => value),
    projectArchivedSessions: projectArchivedSessions || ((entries) => entries),
  });
  return { repository, calls };
}

test("historyRepository: load compacts, loads and exposes an isolated snapshot", async () => {
  const stored = [{ sessionId: "s1", turn: { id: "t1" } }];
  const { repository, calls } = makeRepository({
    responses: {
      compact_history_entries: { removedCount: 1 },
      load_history_entries: stored,
    },
  });
  const result = await repository.load();
  assert.deepEqual(calls.map((item) => item.command), ["compact_history_entries", "load_history_entries"]);
  assert.match(result.notice.message, /去重 1/);
  const snapshot = repository.getEntriesSnapshot();
  snapshot.push({ sessionId: "external" });
  assert.equal(repository.getEntriesSnapshot().length, 1);
  assert.equal(repository.isLoading(), false);
});

test("historyRepository: failed load keeps last usable snapshot and loading state", async () => {
  let shouldFail = false;
  const { repository } = makeRepository({
    responses: {
      compact_history_entries: {},
      load_history_entries: () => {
        if (shouldFail) throw new Error("boom");
        return [{ sessionId: "s1" }];
      },
    },
  });
  await repository.load();
  shouldFail = true;
  await assert.rejects(repository.load(), /boom/);
  assert.deepEqual(repository.getEntriesSnapshot(), [{ sessionId: "s1" }]);
  assert.equal(repository.isLoading(), false);
});

test("historyRepository: appendTurn builds payload and upserts returned entry", async () => {
  const saved = { sessionId: "s1", turn: { id: "t1", prompt: "saved" } };
  const { repository, calls } = makeRepository({
    responses: {
      append_history_entry: saved,
    },
    buildPayload: ({ session, turn }) => ({ sessionId: session.id, turn }),
  });
  await repository.appendTurn({ session: { id: "s1" }, turn: { id: "t1" } });
  assert.deepEqual(calls[0], {
    command: "append_history_entry",
    args: { entry: { sessionId: "s1", turn: { id: "t1" } } },
  });
  assert.deepEqual(repository.getEntriesSnapshot(), [saved]);
});

test("historyRepository: appended turn remains visible after reload", async () => {
  let stored = [];
  const saved = {
    sessionId: "s1",
    record_state: "active",
    access_mode: "read_only",
    turn: { id: "t1", status: "completed" },
  };
  const { repository } = makeRepository({
    responses: {
      append_history_entry: () => {
        stored = [saved];
        return saved;
      },
      compact_history_entries: {},
      load_history_entries: () => stored,
    },
    buildPayload: ({ session, turn }) => ({ sessionId: session.id, turn }),
  });

  await repository.appendTurn({ session: { id: "s1" }, turn: { id: "t1" } });
  assert.deepEqual(repository.getEntriesSnapshot(), [saved]);
  await repository.load();
  assert.deepEqual(repository.getEntriesSnapshot(), [saved]);
});

test("historyRepository: archiveSession reloads backend entries", async () => {
  const { repository, calls } = makeRepository({
    responses: {
      archive_history_session_entries: null,
      load_history_entries: [{ sessionId: "s1", record_state: "archived" }],
    },
  });
  await repository.archiveSession("s1");
  assert.deepEqual(calls.map((item) => item.command), [
    "archive_history_session_entries",
    "load_history_entries",
  ]);
  assert.equal(repository.getEntriesSnapshot()[0].record_state, "archived");
});

test("historyRepository: deleteSession hides matching entries from memory and returns backend result", async () => {
  const { repository } = makeRepository({
    responses: {
      compact_history_entries: {},
      load_history_entries: [{ sessionId: "s1" }, { sessionId: "s2" }],
      delete_history_session_entries: { removedCount: 1 },
    },
  });
  await repository.load();
  const result = await repository.deleteSession("s1");
  assert.deepEqual(result, { removedCount: 1 });
  assert.deepEqual(repository.getEntriesSnapshot(), [{ sessionId: "s2" }]);
});

test("historyRepository: deleteSession only hides the matching Luna session key", async () => {
  const liveEntry = { sessionId: "s1", acpSessionId: "shared-runtime" };
  const legacyEntry = { id: "legacy-entry", acpSessionId: "shared-runtime" };
  const { repository } = makeRepository({
    responses: {
      compact_history_entries: {},
      load_history_entries: [liveEntry, legacyEntry],
      delete_history_session_entries: { removedCount: 1 },
    },
  });

  await repository.load();
  await repository.deleteSession("s1");

  assert.deepEqual(repository.getEntriesSnapshot(), [legacyEntry]);
});

test("historyRepository: archived projection and subscriptions observe repository changes", async () => {
  let notifications = 0;
  const { repository } = makeRepository({
    responses: {
      compact_history_entries: {},
      load_history_entries: [{ sessionId: "s1" }],
    },
    projectArchivedSessions: (entries) => entries.map((entry) => ({ id: entry.sessionId })),
  });
  const unsubscribe = repository.subscribe(() => {
    notifications += 1;
  });
  await repository.load();
  unsubscribe();
  assert.deepEqual(repository.getArchivedSessions(), [{ id: "s1" }]);
  assert.equal(notifications, 2);
});
