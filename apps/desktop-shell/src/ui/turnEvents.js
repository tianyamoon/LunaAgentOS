/**
 * Turn 事件流 view-model（纯函数）
 *
 * 把现有 `turn.thoughts / turn.logs / turn.outputs / turn.finalResponse / turn.state`
 * 推导成 AionUI 风格的事件节点列表。设计目标：
 *   - 不修改 runtime 写入路径（streamEvents.js 不动）
 *   - 不改变 turn 持久化结构
 *   - 历史 turn / 实时 turn 都能 fallback 解析
 *
 * 节点 schema:
 *   {
 *     id: string,
 *     kind: "thinking" | "tool" | "plan" | "usage" | "state" | "log" | "error",
 *     status: "running" | "done" | "info" | "error",
 *     title: string,
 *     detail?: string,
 *     raw?: string,
 *   }
 */

const RUNNING_STATES = new Set([0, 1, 2, 3]);

export function isStreamingTurnState(state) {
  return RUNNING_STATES.has(state);
}

export function turnEventsFromTurn(turn, options = {}) {
  if (!turn) return [];
  const translate = typeof options.translate === "function" ? options.translate : (key) => key;
  const streaming = options.streaming ?? isStreamingTurnState(turn.state);
  const turnId = turn.id || "turn";
  const events = [];

  const thoughtBlocks = Array.isArray(turn.thoughts) ? turn.thoughts.filter(Boolean) : [];
  if (thoughtBlocks.length) {
    const detail = thoughtBlocks.join("\n\n").trim();
    if (detail) {
      const isError = turn.state === 9 && !turn.finalResponse;
      const isRunning = streaming && !turn.finalResponse;
      events.push({
        id: `${turnId}:thinking`,
        kind: "thinking",
        status: isError ? "error" : isRunning ? "running" : "done",
        title: isRunning
          ? translate("turn.events.thinkingRunning")
          : translate("turn.events.thinkingDone"),
        detail,
      });
    }
  }

  const logs = Array.isArray(turn.logs) ? turn.logs : [];
  // logs 是 prepend 的（最新在前），事件流按时间正序展示。
  const orderedLogs = [...logs].reverse();
  orderedLogs.forEach((line, index) => {
    const node = classifyLogLine(line, translate);
    if (!node) return;
    events.push({
      ...node,
      id: `${turnId}:log:${index}`,
      raw: line,
    });
  });

  if (turn.state === 9) {
    const errorRaw = orderedLogs.length ? orderedLogs[orderedLogs.length - 1] : "";
    const lastIsError = events.length && events[events.length - 1].status === "error";
    if (!lastIsError) {
      events.push({
        id: `${turnId}:error`,
        kind: "error",
        status: "error",
        title: translate("turn.events.errorTitle"),
        detail: errorRaw || undefined,
      });
    }
  }

  return events;
}

export function turnEventCounts(events) {
  const counts = { thinking: 0, tool: 0, plan: 0, usage: 0, state: 0, log: 0, error: 0 };
  for (const event of events) {
    if (counts[event.kind] != null) counts[event.kind] += 1;
  }
  return counts;
}

export function turnHasRunningEvent(events) {
  return events.some((event) => event.status === "running");
}

function classifyLogLine(line, translate) {
  if (typeof line !== "string") return null;
  const trimmed = line.trim();
  if (!trimmed) return null;

  const planDetailsPrefix = safeTranslate(translate, "event.planUpdatedWithDetails");
  if (planDetailsPrefix && trimmed.startsWith(planDetailsPrefix)) {
    const detail = trimmed.slice(planDetailsPrefix.length).replace(/^[\s:：]+/, "");
    return {
      kind: "plan",
      status: "info",
      title: safeTranslate(translate, "event.planUpdated") || planDetailsPrefix,
      detail: detail || undefined,
    };
  }

  const planTitle = safeTranslate(translate, "event.planUpdated");
  if (planTitle && trimmed === planTitle) {
    return { kind: "plan", status: "info", title: planTitle };
  }

  const usagePrefix = usageUpdatedPrefix(translate);
  if (usagePrefix && trimmed.startsWith(usagePrefix)) {
    return { kind: "usage", status: "info", title: trimmed };
  }

  const separator = safeTranslate(translate, "event.statusSeparator");
  if (separator && !trimmed.includes("\n")) {
    const sepIndex = trimmed.indexOf(separator);
    if (sepIndex > 0 && sepIndex < trimmed.length - separator.length) {
      const head = trimmed.slice(0, sepIndex).trim();
      const tail = trimmed.slice(sepIndex + separator.length).trim();
      if (head && tail && head.length <= 80) {
        return {
          kind: "tool",
          status: classifyToolStatus(tail),
          title: head,
          detail: tail,
        };
      }
    }
  }

  return { kind: "log", status: "info", title: trimmed };
}

function classifyToolStatus(statusText) {
  const value = statusText.toLowerCase();
  if (/(done|ok|complete|success|completed|finished|完成|成功)/.test(value)) return "done";
  if (/(error|fail|failed|拒绝|失败|错误)/.test(value)) return "error";
  if (/(run|running|progress|in_progress|pending|进行|执行中)/.test(value)) return "running";
  return "info";
}

function usageUpdatedPrefix(translate) {
  const sentinel = "\u0001USAGE_PARTS\u0001";
  const sample = safeTranslate(translate, "event.usageUpdated", { parts: sentinel });
  if (!sample) return "";
  const idx = sample.indexOf(sentinel);
  return idx > 0 ? sample.slice(0, idx) : "";
}

function safeTranslate(translate, key, params) {
  try {
    const value = translate(key, params);
    return typeof value === "string" ? value : "";
  } catch (error) {
    return "";
  }
}
