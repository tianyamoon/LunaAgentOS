// History Payload Module。
// 这里仅负责前后端 History 契约的纯数据转换，不执行 invoke，也不触碰 DOM 或 Store。

import { historyTurnKey } from "./entries.js";

// 构造后端 append_history_entry 命令所需的数据。
// 状态名称映射由调用方注入，使这个 Module 不依赖主程序中的映射表。
export function buildHistoryEntryPayload({
  session,
  turn,
  agentEntrySnapshot,
  schemaVersion,
  runtimeState,
  getStateName,
}) {
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
    agentEntrySnapshot: agentEntrySnapshot || null,
    sessionId: session.id,
    acpSessionId: session.acpSessionId || null,
    task: turn.task,
    status,
    summary,
    turn,
    runtime_state: runtimeState,
    record_state: session.record_state || null,
    access_mode: session.access_mode || null,
    runtime_binding: session.runtime_binding || null,
  };
}

// 按 historyTurnKey 插入或替换条目，并返回新的数组，避免修改调用方持有的快照。
export function upsertHistoryEntry(entries, entry) {
  const list = Array.isArray(entries) ? entries : [];
  const key = historyTurnKey(entry);
  const idx = list.findIndex((item) => historyTurnKey(item) === key);
  if (idx >= 0) {
    return list.map((item, index) => (index === idx ? entry : item));
  }
  return [entry, ...list];
}

// 把后端压缩结果转换为用户可读通知；没有变化时不展示提示。
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
