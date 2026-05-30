// Pure helpers around the history.json payload contract with the Tauri backend.
//
// These do NOT call invoke() or touch DOM/state. They model:
// - what fields make up a single history entry payload
// - how a freshly-appended entry merges back into the in-memory historyEntries list
// - how the Rust compact_history_entries result maps to a user-facing notice
//
// Keeping them pure makes them trivial to unit-test under Node and lets
// `saveTurnToHistory` / `loadHistory` in main.js focus on IO + state mutation.

import { historyTurnKey } from "./entries.js";

/**
 * Build the payload object that the backend `append_history_entry` command expects.
 *
 * Caller supplies a `getStateName(state)` function so the module stays free of the
 * state-name mapping table (which lives in main.js for now).
 */
export function buildHistoryEntryPayload({
  session,
  turn,
  hermesProfile,
  schemaVersion,
  runtimeState,
  getStateName,
}) {
  const turnForHistory = hermesProfile
    ? { ...turn, meta: { ...(turn.meta || {}), hermesProfile } }
    : turn;
  const status = turn.status || (typeof getStateName === "function"
    ? getStateName(turn.state) || "UNKNOWN"
    : "UNKNOWN");
  const summary = turn.finalResponse
    || (Array.isArray(turn.outputs) ? turn.outputs.at(-1) : undefined)
    || (Array.isArray(turn.logs) ? turn.logs.at(0) : undefined)
    || "消息已结束。";
  return {
    schemaVersion,
    providerId: session.providerId,
    providerName: session.providerName,
    agentId: session.agentId,
    agentName: session.agentName,
    runtimeInstanceId: session.runtimeInstanceId || null,
    runtimeLabel: session.runtimeLabel || null,
    runtimeHost: session.runtimeHost || null,
    runtimeCommand: session.runtimeCommand || null,
    targetId: session.targetId || session.agentId,
    targetName: session.targetName || session.agentName,
    profileExecutable: session.profileExecutable || null,
    sessionId: session.id,
    acpSessionId: session.acpSessionId || null,
    task: turn.task,
    status,
    summary,
    turn: turnForHistory,
    runtime_state: runtimeState,
    record_state: session.record_state || null,
    access_mode: session.access_mode || null,
    runtime_binding: session.runtime_binding || null,
  };
}

/**
 * Insert (or replace) `entry` inside `entries`, keyed by historyTurnKey.
 * Always returns a new array — never mutates the input.
 */
export function upsertHistoryEntry(entries, entry) {
  const list = Array.isArray(entries) ? entries : [];
  const key = historyTurnKey(entry);
  const idx = list.findIndex((item) => historyTurnKey(item) === key);
  if (idx >= 0) {
    return list.map((item, index) => (index === idx ? entry : item));
  }
  return [entry, ...list];
}

/**
 * Map the backend compact_history_entries result to a user-facing notice.
 * Returns null if there is nothing to surface.
 */
export function formatCompactHistoryNotice(result) {
  const removedCount = result?.removedCount || 0;
  const upgradedCount = result?.upgradedCount || 0;
  const skippedFiles = result?.skippedFiles || 0;
  if (removedCount === 0 && upgradedCount === 0 && skippedFiles === 0) {
    return null;
  }
  return {
    message: `历史记录已整理：去重 ${removedCount} 条，升级 ${upgradedCount} 条，跳过损坏文件 ${skippedFiles} 个。`,
    kind: skippedFiles > 0 ? "error" : "info",
  };
}
