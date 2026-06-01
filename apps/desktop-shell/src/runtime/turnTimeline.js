// Turn Timeline Module。
// 这里保存 Runtime Event 的到达顺序，让 UI 可以按因果关系展示过程，而不是按事件类型分区。

const MERGEABLE_STREAM_TYPES = new Set(["thinking", "assistant"]);
let generatedTimelineItemSequence = 0;

// 初始化 Timeline 字段时保留已有数据，便于历史恢复和流式增量更新共用同一入口。
export function ensureTurnTimeline(turn, { now = Date.now } = {}) {
  if (!turn || typeof turn !== "object") return null;
  if (!Array.isArray(turn.timelineItems)) turn.timelineItems = [];
  if (!turn.timelineStartedAt) turn.timelineStartedAt = timestamp(now);
  if (!Object.hasOwn(turn, "activeTimelineItemId")) turn.activeTimelineItemId = null;
  if (!Object.hasOwn(turn, "timelineCompletedAt")) turn.timelineCompletedAt = null;
  return turn;
}

// 按事件到达顺序追加 Timeline Item；相邻流式文本会合并，工具等离散事件会自然打断文本片段。
export function appendTurnTimelineEvent(turn, event, { now = Date.now } = {}) {
  if (!turn || !event) return null;
  ensureTurnTimeline(turn, { now });
  const item = timelineItemFromRuntimeEvent(event, { now });
  if (!item) return null;

  // ACP 会把一次工具调用拆成多个 update；同一工具只保留一个可读节点，原始片段仍留给 Debug。
  const existingTool = item.type === "tool" && item.id
    ? turn.timelineItems.find((entry) => entry.type === "tool" && entry.id === item.id)
    : null;
  if (existingTool) {
    existingTool.status = item.status;
    existingTool.updatedAt = item.updatedAt;
    existingTool.content = preferredToolContent(existingTool.content, item.content, item.id);
    existingTool.metadata = {
      ...existingTool.metadata,
      ...item.metadata,
      rawEvents: [
        ...(existingTool.metadata?.rawEvents || [existingTool.metadata?.rawEvent].filter(Boolean)),
        item.metadata.rawEvent,
      ],
    };
    return existingTool;
  }

  const active = activeTimelineItem(turn);
  if (active && active.type === item.type && MERGEABLE_STREAM_TYPES.has(item.type)) {
    active.content += item.content;
    active.updatedAt = item.updatedAt;
    active.metadata = { ...active.metadata, ...item.metadata };
    return active;
  }

  closeActiveTimelineItem(turn, { now, status: "completed" });
  turn.timelineItems.push(item);
  turn.activeTimelineItemId = item.status === "running" ? item.id : null;
  return item;
}

// 完成 Turn 时关闭仍在流式更新的 Item，并记录完成时间供 Worked for 摘要使用。
export function finalizeTurnTimeline(turn, { now = Date.now } = {}) {
  if (!turn) return null;
  ensureTurnTimeline(turn, { now });
  closeActiveTimelineItem(turn, { now, status: "completed" });
  turn.timelineCompletedAt = turn.timelineCompletedAt || timestamp(now);
  return turn;
}

// 旧历史缺少精确交叉顺序，只能生成明确标记为近似结果的摘要 Timeline。
export function reconstructLegacyTurnTimeline(turn, { now = Date.now } = {}) {
  if (!turn || Array.isArray(turn.timelineItems)) return turn;
  ensureTurnTimeline(turn, { now });
  const metadata = { legacyApproximation: true };
  const thoughts = Array.isArray(turn.thoughts) ? turn.thoughts.filter(Boolean) : [];
  const logs = Array.isArray(turn.logs) ? [...turn.logs].reverse().filter(Boolean) : [];
  const response = turn.finalResponse || (Array.isArray(turn.outputs) ? turn.outputs.join("\n\n") : "");

  thoughts.forEach((content) => appendLegacyTimelineItem(turn, "thinking", content, metadata, now));
  logs.forEach((content) => appendLegacyTimelineItem(turn, "runtime", content, metadata, now));
  if (response) appendLegacyTimelineItem(turn, "assistant", response, metadata, now);
  turn.activeTimelineItemId = null;
  turn.timelineCompletedAt = turn.timelineCompletedAt || turn.createdAt || timestamp(now);
  return turn;
}

// Runtime Event 转换保持通用：Adapter 可以通过 payload metadata 补充语义，Shell 不识别产品名称。
export function timelineItemFromRuntimeEvent(event, { now = Date.now } = {}) {
  const type = timelineType(event.type);
  if (!type) return null;
  const createdAt = timestamp(now);
  const payload = event.payload || {};
  return {
    id: payload.id || event.id || generatedTimelineItemId(createdAt, type),
    type,
    status: timelineStatus(event, type),
    content: timelineContent(event, type),
    createdAt,
    updatedAt: createdAt,
    metadata: {
      ...(payload.metadata || {}),
      ...(payload.category ? { category: payload.category } : {}),
      rawEvent: event,
      rawEvents: [event],
    },
  };
}

// 同一毫秒内可能连续收到多个片段；本地序号避免 active item 错误指向较早的同类型节点。
function generatedTimelineItemId(createdAt, type) {
  generatedTimelineItemSequence += 1;
  return `timeline-${createdAt}-${type}-${generatedTimelineItemSequence}`;
}

function activeTimelineItem(turn) {
  if (!turn?.activeTimelineItemId) return null;
  return turn.timelineItems.find((item) => item.id === turn.activeTimelineItemId) || null;
}

function closeActiveTimelineItem(turn, { now, status }) {
  const active = activeTimelineItem(turn);
  if (!active) return;
  active.status = status;
  active.updatedAt = timestamp(now);
  turn.activeTimelineItemId = null;
}

function appendLegacyTimelineItem(turn, type, content, metadata, now) {
  const createdAt = timestamp(now);
  turn.timelineItems.push({
    id: `legacy-${createdAt}-${type}-${turn.timelineItems.length}`,
    type,
    status: "completed",
    content: String(content),
    createdAt,
    updatedAt: createdAt,
    metadata,
  });
}

function timelineType(type) {
  if (type === "thought") return "thinking";
  if (type === "response") return "assistant";
  if (type === "fileChange" || type === "file_change") return "file_change";
  if (type === "state") return "runtime";
  return new Set(["tool", "permission", "plan", "usage", "error", "runtime"]).has(type) ? type : "runtime";
}

function timelineStatus(event, type) {
  const value = String(event.payload?.status || "").toLowerCase();
  if (event.state === 9 || /(error|fail|failed|失败|错误)/.test(value)) return "failed";
  if (type === "permission" || /(waiting|pending|confirm|等待|确认)/.test(value)) return "waiting";
  if (event.state === 5 || /(done|complete|completed|success|成功|完成)/.test(value)) return "completed";
  return MERGEABLE_STREAM_TYPES.has(type) || /(run|running|progress|执行中|进行中)/.test(value)
    ? "running"
    : "completed";
}

function timelineContent(event, type) {
  const payload = event.payload || {};
  const content = payload.content;
  // 工具节点标题保持稳定；状态与输出由节点状态和 Debug 承接，避免完成后仍显示 pending。
  if (type === "tool" && payload.title) return payload.title;
  if (typeof content === "string") return content;
  if (content != null) return JSON.stringify(content);
  if (type === "tool") return payload.title || payload.kind || payload.id || "";
  if (type === "permission") return payload.title || payload.description || "";
  return payload.title || event.message || "";
}

function preferredToolContent(current, next, toolId) {
  const readableCurrent = readableToolContent(current, toolId);
  const readableNext = readableToolContent(next, toolId);
  return readableNext || readableCurrent || "";
}

function readableToolContent(content, toolId) {
  const value = String(content || "").trim();
  return value && value !== toolId ? value : "";
}

function timestamp(now) {
  const value = typeof now === "function" ? now() : now;
  return new Date(value).toISOString();
}
