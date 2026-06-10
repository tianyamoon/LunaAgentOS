import test from "node:test";
import assert from "node:assert/strict";

import {
  ACCESS_MODE,
  CARD_STATUS,
  RECORD_STATE,
  TURN_STATUS,
  createRuntimeBinding,
  normalizeSessionStatusShape,
  resolveSessionCardControlState,
  resolveSessionListPresentationState,
} from "./sessionStatus.js";
import { projectWorkspaceStatus } from "./workspaceStatusProjection.js";
import { projectHistoryListItemState } from "../ui/historyView.js";
import { projectRuntimeSessionMessageList } from "../ui/runtimeSessionMessageListProjection.js";

const t = (key) => ({
  "sessionStatus.waitingInput": "waiting",
  "sessionStatus.waitingInputDetail": "waiting detail",
  "sessionStatus.running": "running",
  "sessionStatus.runningDetail": "running detail",
  "sessionStatus.reconnecting": "reconnecting",
  "sessionStatus.reconnectingDetail": "reconnecting detail",
  "sessionStatus.waitingConfirmation": "confirm",
  "sessionStatus.waitingConfirmationDetail": "confirm detail",
  "sessionStatus.blocked": "blocked",
  "sessionStatus.blockedDetail": "blocked detail",
  "sessionStatus.failed": "failed",
  "sessionStatus.failedDetail": "failed detail",
  "sessionStatus.completed": "completed",
  "sessionStatus.completedDetail": "completed detail",
  "sessionStatus.archived": "archived",
  "sessionStatus.archivedDetail": "archived detail",
  "sessionStatus.readonlyHistory": "read-only",
  "sessionStatus.readonlyHistoryDetail": "read-only detail",
  "sessionStatus.secondary.completed": "last completed",
  "sessionStatus.secondary.failed": "last failed",
  "sessionStatus.secondary.cancelled": "last cancelled",
  "sessionStatus.secondary.running": "last running",
  "sessionStatus.secondary.waiting_confirmation": "last confirm",
  "sessionStatus.secondary.created": "not run",
  "sessionStatus.error.defaultTitle": "runtime failed",
  "sessionStatus.error.defaultSuggestion": "retry",
  "history.signal.live": "live",
})[key] || key;

function session(overrides = {}) {
  const item = {
    id: "s1",
    providerId: "test",
    providerName: "Test",
    agentId: "agent-a",
    agentName: "Agent A",
    task: "task",
    createdAt: "2026-06-01T00:00:00.000Z",
    record_state: RECORD_STATE.active,
    access_mode: ACCESS_MODE.interactive,
    runtime_binding: createRuntimeBinding({ state: "connected" }),
    turns: [],
    ...overrides,
  };
  normalizeSessionStatusShape(item);
  return item;
}

function presentationFor(input, { canSend = false, canRestore = false } = {}) {
  const canSendToSession = () => canSend;
  const canRestoreSession = () => canRestore;
  const card = resolveSessionCardControlState(input, {
    translate: t,
    canSendToSession,
    canRestoreSession,
  });
  const history = projectHistoryListItemState(input, {
    getSession: () => null,
    ensureSessionStatusShape: normalizeSessionStatusShape,
    resolveSessionListPresentationState,
    canSendToSession,
    canRestoreSession,
    translate: t,
  });
  const workspace = projectWorkspaceStatus({
    agent: { id: input.agentId, name: input.agentName, state: 1 },
    provider: { id: input.providerId },
    currentSession: input,
    availability: { summary: "available" },
    canSendToSession,
    canRestoreSession,
    translate: t,
    targetDisplayName: (agent) => agent.name,
  });
  const messages = projectRuntimeSessionMessageList(input);

  return { card, history, workspace, messages };
}

test("session presentation stays consistent for a completed stale-active session", () => {
  const input = session({
    activeTurnId: "old",
    activePromptRunId: "run-old",
    turns: [
      { id: "old", status: TURN_STATUS.running, promptRunId: "run-old", task: "old", timelineItems: [] },
      { id: "latest", status: TURN_STATUS.completed, task: "latest", finalResponse: "done" },
    ],
  });

  const { card, history, workspace, messages } = presentationFor(input, { canSend: true });

  assert.equal(card.statusView.status, CARD_STATUS.completed);
  assert.equal(history.statusView.status, CARD_STATUS.completed);
  assert.equal(workspace.sessionStatusView.status, CARD_STATUS.completed);
  assert.equal(messages.rows.some((row) => row.status === TURN_STATUS.running), false);
});

test("session presentation keeps only the live current turn marked running", () => {
  const input = session({
    activeTurnId: "latest",
    activePromptRunId: "run-latest",
    turns: [
      { id: "old", status: TURN_STATUS.completed, task: "old", finalResponse: "old done" },
      {
        id: "latest",
        status: TURN_STATUS.running,
        task: "latest",
        promptRunId: "run-latest",
        timelineItems: [{ id: "think", type: "thinking", status: "running", content: "thinking" }],
      },
    ],
  });

  const { card, history, workspace, messages } = presentationFor(input, { canSend: true });

  assert.equal(card.statusView.status, CARD_STATUS.running);
  assert.equal(history.statusView.status, CARD_STATUS.running);
  assert.equal(workspace.sessionStatusView.status, CARD_STATUS.running);
  assert.deepEqual(
    messages.rows.filter((row) => row.status === TURN_STATUS.running).map((row) => row.turnId),
    ["latest", "latest"],
  );
});

test("session presentation shows reconnecting consistently without marking completed rows running", () => {
  const input = session({
    runtime_binding: createRuntimeBinding({ state: "reconnecting", stage: "load" }),
    turns: [{ id: "latest", status: TURN_STATUS.completed, task: "latest", finalResponse: "done" }],
  });

  const { card, history, workspace, messages } = presentationFor(input);

  assert.equal(card.statusView.status, CARD_STATUS.reconnecting);
  assert.equal(history.statusView.status, CARD_STATUS.reconnecting);
  assert.equal(workspace.sessionStatusView.status, CARD_STATUS.reconnecting);
  assert.equal(card.statusView.secondary_status?.status, TURN_STATUS.completed);
  assert.equal(messages.rows.some((row) => row.status === TURN_STATUS.running), false);
});

test("session presentation treats read-only unfinished history as read-only everywhere", () => {
  const input = session({
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "old", status: TURN_STATUS.running, task: "old" }],
  });

  const { card, history, workspace, messages } = presentationFor(input);

  assert.equal(card.statusView.status, CARD_STATUS.readonly_history);
  assert.equal(history.statusView.status, CARD_STATUS.readonly_history);
  assert.equal(workspace.sessionStatusView.status, CARD_STATUS.readonly_history);
  assert.equal(messages.rows.some((row) => row.status === TURN_STATUS.running), false);
});

test("session presentation keeps manual archive as the visible state", () => {
  const input = session({
    record_state: RECORD_STATE.archived,
    access_mode: ACCESS_MODE.read_only,
    turns: [{ id: "done", status: TURN_STATUS.completed, task: "done", finalResponse: "done" }],
  });

  const { card, history, workspace } = presentationFor(input, { canRestore: true });

  assert.equal(card.statusView.status, CARD_STATUS.archived);
  assert.equal(history.statusView.status, CARD_STATUS.archived);
  assert.equal(workspace.sessionStatusView.status, CARD_STATUS.archived);
});
