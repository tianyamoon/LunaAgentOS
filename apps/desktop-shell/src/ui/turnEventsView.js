/**
 * 把 turnEvents.js 输出的事件节点渲染成 HTML 字符串。
 *
 * 设计参考 AionUI 的 MessageThinking / MessageToolCall / MessagePlan：
 *   - 单行 summary（状态点 + 类型标签 + 标题 + 可选耗时/状态徽标）
 *   - 有 detail 时点击展开
 *   - running 默认展开、done/info 默认折叠
 *   - 不引入新依赖；用 vanilla details/summary
 */

const KIND_LABEL_KEYS = {
  thinking: "turn.events.kind.thinking",
  tool: "turn.events.kind.tool",
  plan: "turn.events.kind.plan",
  usage: "turn.events.kind.usage",
  state: "turn.events.kind.state",
  log: "turn.events.kind.log",
  error: "turn.events.kind.error",
};

export function renderTurnEventsHtml(events, options = {}) {
  if (!Array.isArray(events) || !events.length) return "";
  const translate = typeof options.translate === "function" ? options.translate : (key) => key;
  const escapeHtml = typeof options.escapeHtml === "function" ? options.escapeHtml : passthrough;
  const isOpenForKey = typeof options.isOpenForKey === "function" ? options.isOpenForKey : null;

  const items = events.map((event) => renderTurnEventItemHtml(event, { translate, escapeHtml, isOpenForKey })).join("");
  return `<ul class="turn-events" role="list">${items}</ul>`;
}

export function renderTurnEventItemHtml(event, options = {}) {
  if (!event) return "";
  const translate = typeof options.translate === "function" ? options.translate : (key) => key;
  const escapeHtml = typeof options.escapeHtml === "function" ? options.escapeHtml : passthrough;
  const isOpenForKey = typeof options.isOpenForKey === "function" ? options.isOpenForKey : null;

  const kind = event.kind || "log";
  const status = event.status || "info";
  const kindLabel = translate(KIND_LABEL_KEYS[kind] || KIND_LABEL_KEYS.log);
  const title = event.title || translate("turn.events.untitled");
  const detail = typeof event.detail === "string" ? event.detail : "";
  const hasDetail = Boolean(detail.trim());
  const detailKey = event.id || "";
  const defaultOpen = status === "running" || status === "error";
  const open = hasDetail
    ? (isOpenForKey ? isOpenForKey(detailKey, defaultOpen) : defaultOpen)
    : false;

  const classes = [
    "turn-event",
    `turn-event-kind-${escapeAttr(kind)}`,
    `turn-event-status-${escapeAttr(status)}`,
    hasDetail ? "has-detail" : "no-detail",
  ].join(" ");

  const dot = `<span class="turn-event-dot" aria-hidden="true"></span>`;
  const kindBadge = `<span class="turn-event-kind">${escapeHtml(kindLabel)}</span>`;
  const titleNode = `<span class="turn-event-title">${escapeHtml(title)}</span>`;

  if (!hasDetail) {
    return `<li class="${classes}" data-event-id="${escapeAttr(detailKey)}" data-event-kind="${escapeAttr(kind)}" data-event-status="${escapeAttr(status)}">
      <div class="turn-event-row">${dot}${kindBadge}${titleNode}</div>
    </li>`;
  }

  const detailsExtraClass = typeof options.detailsExtraClass === "string" ? options.detailsExtraClass : "";
  const detailsClass = ["turn-event-details", detailsExtraClass].filter(Boolean).join(" ");
  return `<li class="${classes}" data-event-id="${escapeAttr(detailKey)}" data-event-kind="${escapeAttr(kind)}" data-event-status="${escapeAttr(status)}">
    <details class="${detailsClass}" data-detail-key="${escapeAttr(detailKey)}"${open ? " open" : ""}>
      <summary class="turn-event-row">
        ${dot}${kindBadge}${titleNode}
        <span class="turn-event-arrow" aria-hidden="true"></span>
      </summary>
      <div class="turn-event-detail">${escapeHtml(detail)}</div>
    </details>
  </li>`;
}

function escapeAttr(value) {
  return String(value || "").replace(/["&<>]/g, (ch) => ({
    '"': "&quot;",
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  })[ch]);
}

function passthrough(value) {
  return String(value ?? "");
}
