// Runtime Session 连续消息流投影。
// 这里把内部 Turn / Timeline 事实整理成稳定 Message 行，视图不再暴露“第 N 轮”容器。

import {
  activeOrLatestTurn,
  isRunningTurnStatus,
  isTerminalTurnStatus,
} from "../state/sessionStatus.js";
import {
  projectCompletedTimelineSummary,
  projectLiveTimeline,
  timelineItemsForTurn,
} from "./turnTimelineProjection.js";

const RUNNING_TURN_STATUSES = new Set(["running", "waiting_confirmation"]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value || "");
}

function compactText(value, maxLength = 108) {
  const normalized = text(value).replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function responseText(turn) {
  return turn?.finalResponse || list(turn?.outputs).join("\n\n");
}

function promptRunIdForTurn(turn) {
  return turn?.promptRunId || null;
}

function rowId(turn, suffix) {
  return `${turn.id}:${suffix}`;
}

// MessageList 的外部接口：调用方只消费 rows，不需要理解 Turn 的内部结构。
export function projectRuntimeSessionMessageList(session, options = {}) {
  const turns = list(session?.turns);
  const latestTurn = activeOrLatestTurn(session);
  const visibleTurns = options.latestOnly && latestTurn ? [latestTurn] : turns;
  const rows = visibleTurns.flatMap((turn) => projectTurnRows(turn, {
    latestTurnId: latestTurn?.id || null,
    forceLive: Boolean(session?.activePromptRunId && turn.id === latestTurn?.id),
    isCurrentTurn: turn.id === latestTurn?.id,
    readOnly: session?.access_mode === "read_only",
  }));
  const runtimeRows = !rows.length && session?.runtime_binding?.state === "reconnecting"
    ? [projectSessionRuntimeRow(session, options)]
    : [];
  return {
    rows: [
      ...rows,
      ...runtimeRows,
      ...list(session?.queuedSubmissions).map(projectQueueRow),
    ],
    latestTurnId: latestTurn?.id || null,
    activePromptRunId: session?.activePromptRunId || null,
    scrollTargetRowId: latestTurn ? rowId(latestTurn, "user") : runtimeRows[0]?.id || null,
  };
}

function projectSessionRuntimeRow(session, options = {}) {
  const stage = session.runtime_binding?.stage || "runtime";
  const content = typeof options.reconnectingRuntimeText === "function"
    ? options.reconnectingRuntimeText(stage)
    : `Restoring ${stage} runtime. The session will become interactive when the connection is ready.`;
  return {
    id: `${session.id}:runtime:${stage}`,
    kind: "runtime",
    turnId: null,
    promptRunId: null,
    status: "reconnecting",
    content,
    metadata: {
      source: "runtime_binding",
      stage,
    },
  };
}

function projectTurnRows(turn, { latestTurnId, forceLive, isCurrentTurn = false, readOnly = false }) {
  const rows = [];
  const turnId = turn?.id;
  if (!turnId) return rows;
  // 只读 transcript 没有可执行 runtime；即便旧快照残留 running，也按历史内容投影。
  const isLive = !readOnly
    && isCurrentTurn
    && (RUNNING_TURN_STATUSES.has(turn.status) || (forceLive && !isTerminalTurnStatus(turn.status)));
  const rowStatus = isLive ? turn.status : completedTurnRowStatus(turn);
  if (turn.meta?.historyIntegrity === "legacy_unverified") {
    rows.push(baseTurnRow(turn, "legacy_warning", "legacy-warning", {
      status: rowStatus,
      content: "",
      metadata: { reason: "legacy_unverified" },
    }));
  }
  rows.push(baseTurnRow(turn, "user", "user", {
    status: rowStatus,
    content: turn.prompt || "",
    metadata: {
      attachments: list(turn.meta?.attachments),
      isLatestTurn: turn.id === latestTurnId,
    },
  }));

  rows.push(...(isLive ? projectLiveTurnRows(turn) : projectCompletedTurnRows(turn)));
  return rows;
}

function projectCompletedTurnRows(turn) {
  const rows = [];
  const completedScope = completedDetailScope(turn);
  const traceRows = projectCompletedTraceRows(turn);
  const debug = debugMetadataForTurn(turn);
  const finalResponse = finalResponseForTurn(turn);
  if (finalResponse) {
    rows.push(baseTurnRow(turn, "assistant", "assistant", {
      content: finalResponse,
      metadata: { final: true },
    }));
  }
  if (traceRows.length || debug) {
    rows.push(baseTurnRow(turn, "worked_for", "worked-for", {
      status: completedTurnRowStatus(turn),
      metadata: {
        summary: projectCompletedTimelineSummary(turn),
        detailKey: `${completedScope}:worked-for`,
        rows: traceRows,
        debug,
      },
    }));
  }
  return rows;
}

function completedTurnRowStatus(turn) {
  const status = turn?.status || "completed";
  if (isRunningTurnStatus(status)) return "completed";
  return status;
}

function projectUnifiedTurnRows(turn) {
  const rows = [];
  const isLive = RUNNING_TURN_STATUSES.has(turn.status);
  const hasNativeTimeline = Array.isArray(turn.timelineItems) && turn.timelineItems.length > 0;
  const timelineRows = projectLiveTimeline(turn).map((item) => timelineItemRow(turn, item, { turnCompleted: !isLive }));
  rows.push(...timelineRows);
  rows.push(...projectLiveRuntimeLogRows(turn, timelineRows));

  // 完成后在顶部放 worked_for 摘要
  if (!isLive && hasNativeTimeline && timelineRows.length) {
    const traceRows = projectLiveTimeline(turn).map((item) => timelineItemRow(turn, item, { turnCompleted: true }));
    rows.unshift(baseTurnRow(turn, "worked_for", "worked-for", {
      status: turn.status || "completed",
      metadata: {
        summary: projectCompletedTimelineSummary(turn),
        rows: traceRows,
      },
    }));
  }

  return rows;
}

function projectLiveTurnRows(turn) {
  const rows = projectLiveTimeline(turn).map((item) => timelineItemRow(turn, item, { turnCompleted: false }));
  rows.push(...projectLiveRuntimeLogRows(turn, rows));
  return rows;
}

function projectLiveRuntimeLogRows(turn, existingRows) {
  const represented = new Set(existingRows.map((row) => compactText(row.content, 140)));
  const entries = list(turn?.logs)
    .map((log, index) => ({ log: compactText(log, 180), index }))
    .filter((entry) => entry.log && !represented.has(compactText(entry.log, 140)));
  const visibleEntries = entries.filter((entry) => isVisibleRuntimeLog(entry.log));
  const waitingEntry = !existingRows.length && !visibleEntries.length
    ? entries.find((entry) => isWaitingForRuntimeLog(entry.log))
    : null;
  return [...visibleEntries, ...(waitingEntry ? [waitingEntry] : [])]
    .slice(-8)
    .map((entry) => baseTurnRow(turn, "runtime", `log:${entry.index}`, {
      status: turn.status || "running",
      content: entry.log,
      metadata: { source: "turn.logs" },
    }));
}

function isVisibleRuntimeLog(log) {
  const value = compactText(log, 180).toLowerCase();
  if (!value) return false;
  if (/(error|failed|failure|timeout|denied|blocked|permission|confirm|approval|错误|失败|超时|拒绝|阻塞|权限|确认|等待确认)/.test(value)) {
    return true;
  }
  if (/(message.*(entered|queued).*session|消息已进入当前会话|等待运行时返回内容)/.test(value)) {
    return false;
  }
  if (/^(tool|工具|工具调用).*(done|complete|completed|success|ok|完成|成功)$/.test(value)) {
    return false;
  }
  return true;
}

function isWaitingForRuntimeLog(log) {
  const value = compactText(log, 180).toLowerCase();
  return /(message.*(entered|queued).*session.*runtime response|\u6d88\u606f.*\u4f1a\u8bdd.*\u7b49\u5f85.*\u8fd4\u56de)/.test(value);
}

function projectCompletedTraceRows(turn) {
  const finalResponse = finalResponseForTurn(turn);
  const items = projectLiveTimeline(turn);
  const lastAssistantIndex = items.findLastIndex((item) => item.type === "assistant");
  const completedScope = completedDetailScope(turn);
  return items
    .filter((item, index) => !(index === lastAssistantIndex && text(item.content).trim() === finalResponse))
    .map((item) => timelineItemRow(turn, item, { turnCompleted: true, completedScope }));
}

function finalResponseForTurn(turn) {
  const explicit = responseText(turn).trim();
  if (explicit) return explicit;
  const items = projectLiveTimeline(turn);
  const lastAssistant = items.findLast((item) => item.type === "assistant");
  return text(lastAssistant?.content).trim();
}

function timelineItemRow(turn, item, options = {}) {
  const suffix = timelineRowSuffix(item, options);
  const detailSuffix = item.type === "tool_group" ? "message-group" : "message";
  // 完成态的过程折叠必须使用独立 key，避免继承运行中用户曾展开的行。
  const detailBase = options.completedScope ? `${options.completedScope}:${suffix}` : rowId(turn, suffix);
  const detailKey = `${detailBase}:${detailSuffix}`;
  const status = timelineItemStatus(item, options);
  if (item.type === "tool_group") {
    return baseTurnRow(turn, "tool_group", suffix, {
      status,
      content: item.content || "",
      metadata: {
        ...item.metadata,
        items: list(item.items).map((tool) => timelineItemRow(turn, tool, options)),
        detailKey,
        turnCompleted: options.turnCompleted || false,
      },
    });
  }
  return baseTurnRow(turn, rowKindForTimelineType(item.type), suffix, {
    status,
    content: item.content || "",
    metadata: { ...item.metadata, detailKey, turnCompleted: options.turnCompleted || false },
  });
}

function timelineItemStatus(item, options = {}) {
  const status = item.status || "completed";
  if (!options.turnCompleted) return status;
  return isRunningTurnStatus(status) ? "completed" : status;
}

function timelineRowSuffix(item, options = {}) {
  const prefix = options.turnCompleted ? "completed-timeline" : "timeline";
  return `${prefix}:${item.id}`;
}

function completedDetailScope(turn) {
  const completedAt = turn?.timelineCompletedAt || turn?.completedAt || turn?.updatedAt || turn?.status || "terminal";
  return rowId(turn, `completed:${completedAt}`);
}

function rowKindForTimelineType(type) {
  if (type === "thinking") return "thinking";
  if (type === "assistant") return "assistant";
  if (type === "tool") return "tool";
  if (type === "permission") return "permission";
  if (type === "file_change") return "file_change";
  if (type === "error") return "error";
  return "runtime";
}

function baseTurnRow(turn, kind, suffix, overrides = {}) {
  return {
    id: rowId(turn, suffix),
    kind,
    turnId: turn.id,
    promptRunId: promptRunIdForTurn(turn),
    status: overrides.status || turn.status || "completed",
    content: overrides.content || "",
    metadata: overrides.metadata || {},
  };
}

function projectQueueRow(submission) {
  return {
    id: `queue:${submission.id}`,
    kind: "queue",
    turnId: null,
    promptRunId: null,
    status: "queued",
    content: compactText(submission.prompt),
    metadata: {
      attachmentCount: list(submission.attachments).length,
      createdAt: submission.createdAt || null,
    },
  };
}

function debugMetadataForTurn(turn) {
  const rawEvents = flattenedTimelineItems(timelineItemsForTurn(turn))
    .flatMap((item) => item.metadata?.rawEvents || [item.metadata?.rawEvent])
    .filter(Boolean);
  const logs = list(turn?.logs);
  if (!rawEvents.length && !logs.length) return null;
  return { rawEvents, logs };
}

function flattenedTimelineItems(items) {
  return list(items).flatMap((item) => item.type === "tool_group" ? item.items : [item]);
}
