// Turn Timeline Projection Module。
// 这里把持久化 Timeline 投影为 UI 可消费的数据，不修改 Turn，也不生成 HTML。

import { reconstructLegacyTurnTimeline } from "../runtime/turnTimeline.js";

// 运行中按原始顺序展示事件，仅把相邻低价值探索工具压缩成一个局部组。
export function projectLiveTimeline(turn) {
  return groupAdjacentExploreTools(timelineItemsForTurn(turn));
}

// 完成摘要提供 Codex 风格 Worked for 行所需数据，不把文案写死在纯逻辑层。
export function projectCompletedTimelineSummary(turn) {
  const items = timelineItemsForTurn(turn);
  return {
    durationMs: durationBetween(turn?.timelineStartedAt || turn?.createdAt, turn?.timelineCompletedAt),
    toolCount: items.filter((item) => item.type === "tool").length,
    fileChangeCount: items.filter((item) => item.type === "file_change").length,
    legacyApproximation: items.some((item) => item.metadata?.legacyApproximation),
  };
}

// 旧历史使用克隆进行近似重建，避免只读归档在渲染阶段被悄悄修改。
export function projectLegacyTimeline(turn) {
  const cloned = cloneTurn(turn);
  reconstructLegacyTurnTimeline(cloned);
  return cloned.timelineItems || [];
}

// 只聚合连续 explore Tool；Thinking、Assistant、Permission 和文件变更都会自然截断工具组。
export function groupAdjacentExploreTools(items) {
  const result = [];
  let pending = [];

  const flush = () => {
    if (!pending.length) return;
    if (pending.length === 1) {
      result.push(pending[0]);
    } else {
      result.push({
        id: `tool-group-${pending[0].id}`,
        type: "tool_group",
        status: pending.some((item) => item.status === "running") ? "running" : "completed",
        content: "",
        metadata: { category: "explore" },
        items: pending,
      });
    }
    pending = [];
  };

  timelineList(items).forEach((item) => {
    if (item.type === "tool" && item.metadata?.category === "explore") {
      pending.push(item);
      return;
    }
    flush();
    result.push(item);
  });
  flush();
  return result;
}

// 新 Turn 直接读取有序数据；旧 Turn 在视图投影时使用近似重建。
export function timelineItemsForTurn(turn) {
  if (Array.isArray(turn?.timelineItems)) return turn.timelineItems;
  return projectLegacyTimeline(turn);
}

function timelineList(items) {
  return Array.isArray(items) ? items : [];
}

function durationBetween(start, end) {
  const startMs = Date.parse(start || "");
  const endMs = Date.parse(end || "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, endMs - startMs);
}

function cloneTurn(turn) {
  if (!turn || typeof turn !== "object") return {};
  return {
    ...turn,
    thoughts: Array.isArray(turn.thoughts) ? [...turn.thoughts] : turn.thoughts,
    outputs: Array.isArray(turn.outputs) ? [...turn.outputs] : turn.outputs,
    logs: Array.isArray(turn.logs) ? [...turn.logs] : turn.logs,
  };
}
