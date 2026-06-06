// Runtime Session 连续消息流投影。
// 这里把内部 Turn / Timeline 事实整理成稳定 Message 行，视图不再暴露“第 N 轮”容器。

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
  const activeTurnId = session?.activeTurnId || null;
  const latestTurn = turns.find((turn) => activeTurnId && turn.id === activeTurnId) || turns.at(-1) || null;
  const visibleTurns = options.latestOnly && latestTurn ? [latestTurn] : turns;
  const rows = visibleTurns.flatMap((turn) => projectTurnRows(turn, {
    latestTurnId: latestTurn?.id || null,
    forceLive: Boolean(session?.activePromptRunId && turn.id === activeTurnId),
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
    status: "running",
    content,
    metadata: {
      source: "runtime_binding",
      stage,
    },
  };
}

function projectTurnRows(turn, { latestTurnId, forceLive }) {
  const rows = [];
  const turnId = turn?.id;
  if (!turnId) return rows;
  if (turn.meta?.historyIntegrity === "legacy_unverified") {
    rows.push(baseTurnRow(turn, "legacy_warning", "legacy-warning", {
      content: "",
      metadata: { reason: "legacy_unverified" },
    }));
  }
  rows.push(baseTurnRow(turn, "user", "user", {
    content: turn.task || "",
    metadata: {
      attachments: list(turn.meta?.attachments),
      isLatestTurn: turn.id === latestTurnId,
    },
  }));

  const isLive = forceLive || RUNNING_TURN_STATUSES.has(turn.status);
  if (isLive) {
    rows.push(...projectLiveTurnRows(turn));
    return rows;
  }

  const finalResponse = responseText(turn);
  if (finalResponse) {
    rows.push(baseTurnRow(turn, "assistant", "assistant-final", {
      content: finalResponse,
      status: turn.status || "completed",
      metadata: { final: true },
    }));
  }
  const traceRows = projectCompletedTraceRows(turn);
  if (traceRows.length) {
    rows.push(baseTurnRow(turn, "worked_for", "worked-for", {
      status: turn.status || "completed",
      metadata: {
        summary: projectCompletedTimelineSummary(turn),
        rows: traceRows,
      },
    }));
  }
  const debug = debugMetadataForTurn(turn);
  if (debug) {
    rows.push(baseTurnRow(turn, "debug", "debug", {
      metadata: debug,
    }));
  }
  return rows;
}

function projectLiveTurnRows(turn) {
  const rows = projectLiveTimeline(turn).map((item) => timelineItemRow(turn, item));
  rows.push(...projectLiveRuntimeLogRows(turn, rows));
  const debug = debugMetadataForTurn(turn);
  if (debug) {
    rows.push(baseTurnRow(turn, "debug", "debug", { metadata: debug }));
  }
  return rows;
}

function projectLiveRuntimeLogRows(turn, existingRows) {
  const represented = new Set(existingRows.map((row) => compactText(row.content, 140)));
  return list(turn?.logs)
    .map((log, index) => ({ log: compactText(log, 180), index }))
    .filter((entry) => entry.log && !represented.has(compactText(entry.log, 140)))
    .slice(-8)
    .map((entry) => baseTurnRow(turn, "runtime", `log:${entry.index}`, {
      status: turn.status || "running",
      content: entry.log,
      metadata: { source: "turn.logs" },
    }));
}

function projectCompletedTraceRows(turn) {
  const finalResponse = responseText(turn).trim();
  const items = projectLiveTimeline(turn);
  const lastAssistantIndex = items.findLastIndex((item) => item.type === "assistant");
  return items
    .filter((item, index) => !(index === lastAssistantIndex && text(item.content).trim() === finalResponse))
    .map((item) => timelineItemRow(turn, item));
}

function timelineItemRow(turn, item) {
  if (item.type === "tool_group") {
    return baseTurnRow(turn, "tool_group", `timeline:${item.id}`, {
      status: item.status || "completed",
      content: item.content || "",
      metadata: {
        ...item.metadata,
        items: list(item.items).map((tool) => timelineItemRow(turn, tool)),
      },
    });
  }
  return baseTurnRow(turn, rowKindForTimelineType(item.type), `timeline:${item.id}`, {
    status: item.status || "completed",
    content: item.content || "",
    metadata: item.metadata || {},
  });
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
    content: compactText(submission.task),
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
