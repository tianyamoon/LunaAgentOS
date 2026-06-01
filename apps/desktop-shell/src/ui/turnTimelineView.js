// Turn Timeline View 负责把有序事件投影为可读 HTML。
// 运行中保留交叉过程；完成后将过程收敛为摘要，让最终回答成为视觉主体。

import {
  projectCompletedTimelineSummary,
  projectLiveTimeline,
} from "./turnTimelineProjection.js";

export function createTurnTimelineView({
  renderAssistantResponse,
  isOpenForKey,
  t,
  escapeHtml,
}) {
  // Turn 主体入口保持纯渲染：展开状态由 Store 查询，交互绑定仍由 Card Controller 负责。
  function renderTurnTimeline(turn, {
    streaming = false,
    failed = false,
    responseText = "",
    rawResponseText = "",
  } = {}) {
    const items = projectLiveTimeline(turn);
    if (streaming) {
      return renderLiveTimeline(items, { waitingText: responseText });
    }
    return `
      ${renderFinalResponse(responseText, { waiting: !rawResponseText })}
      ${renderCompletedTrace(turn, items, { defaultOpen: failed })}
    `;
  }

  function renderLiveTimeline(items, { waitingText }) {
    const timelineHtml = items.map((item) => renderTimelineItem(item, { live: true })).join("");
    if (timelineHtml) return `<div class="turn-timeline is-live">${timelineHtml}</div>`;
    return renderFinalResponse(waitingText, { waiting: true, phase: "streaming" });
  }

  function renderCompletedTrace(turn, items, { defaultOpen }) {
    const traceItems = withoutDuplicatedFinalResponse(items, turn);
    if (!traceItems.length) return "";
    const summary = projectCompletedTimelineSummary(turn);
    const detailKey = `${turn.id}:timeline`;
    const open = isOpenForKey(detailKey, defaultOpen);
    return `
      <details class="terminal-detail turn-timeline-summary" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary class="turn-timeline-summary-row">
          <span class="turn-timeline-summary-label">${escapeHtml(workedForLabel(summary))}</span>
          <span class="turn-event-arrow" aria-hidden="true"></span>
        </summary>
        ${summary.legacyApproximation ? `<p class="turn-timeline-legacy-note">${escapeHtml(t("turn.timeline.legacyApproximation"))}</p>` : ""}
        <div class="turn-timeline is-completed">${traceItems.map((item) => renderTimelineItem(item)).join("")}</div>
      </details>
    `;
  }

  // 完成态已经在主体中展示最终回答；折叠过程里移除完全相同的最后一个 Assistant 片段，避免重复阅读。
  function withoutDuplicatedFinalResponse(items, turn) {
    const finalResponse = String(turn?.finalResponse || "").trim();
    if (!finalResponse) return items;
    const lastAssistantIndex = items.findLastIndex((item) => item.type === "assistant");
    return items.filter((item, index) => {
      return !(index === lastAssistantIndex && String(item.content || "").trim() === finalResponse);
    });
  }

  function workedForLabel(summary) {
    return t("turn.timeline.workedFor", {
      duration: formatTimelineDuration(summary.durationMs),
      tools: summary.toolCount ? t("turn.timeline.toolCount", { count: summary.toolCount }) : "",
      files: summary.fileChangeCount ? t("turn.timeline.fileCount", { count: summary.fileChangeCount }) : "",
    });
  }

  function renderTimelineItem(item, { live = false } = {}) {
    if (item.type === "tool_group") return renderToolGroup(item, { live });
    if (item.type === "assistant") return renderAssistantTimelineItem(item, { live });
    if (item.type === "thinking") return renderThinkingTimelineItem(item);
    return renderCompactTimelineItem(item, { live });
  }

  function renderThinkingTimelineItem(item) {
    return `
      <section class="turn-timeline-item turn-timeline-item-thinking ${statusClass(item)}">
        ${renderTimelineHeading(item, { title: t("turn.timeline.thinking") })}
        <div class="turn-timeline-content">${escapeHtml(item.content || t("turn.timeline.thinking"))}</div>
      </section>
    `;
  }

  function renderAssistantTimelineItem(item, { live }) {
    return `
      <section class="terminal-message assistant-message turn-timeline-item turn-timeline-item-assistant ${statusClass(item)}">
        <div class="terminal-label">${escapeHtml(t("turn.timeline.assistant"))}</div>
        ${renderAssistantResponse(item.content || t("turn.waiting"), live ? "streaming" : "final")}
      </section>
    `;
  }

  function renderCompactTimelineItem(item, { live }) {
    const detailKey = `${item.id}:timeline-item`;
    const content = item.content || t("turn.timeline.emptyEvent");
    const open = isOpenForKey(detailKey, live && item.status === "failed");
    return `
      <details class="terminal-detail turn-timeline-item turn-timeline-item-compact ${statusClass(item)}" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary class="turn-timeline-item-summary">
          ${renderTimelineHeading(item)}
          <span class="turn-event-arrow" aria-hidden="true"></span>
        </summary>
        <pre class="terminal-pre turn-timeline-item-detail">${escapeHtml(content)}</pre>
      </details>
    `;
  }

  function renderToolGroup(item, { live }) {
    const detailKey = `${item.id}:timeline-group`;
    const open = isOpenForKey(detailKey, live && item.status === "running");
    return `
      <details class="terminal-detail turn-timeline-item turn-timeline-item-group ${statusClass(item)}" data-detail-key="${escapeHtml(detailKey)}"${open ? " open" : ""}>
        <summary class="turn-timeline-item-summary">
          <span class="turn-event-dot" aria-hidden="true"></span>
          <span class="turn-timeline-kind">${escapeHtml(t("turn.timeline.kind.tool"))}</span>
          <span class="turn-timeline-item-title">${escapeHtml(t("turn.timeline.exploreTools", { count: item.items.length }))}</span>
          <span class="turn-event-arrow" aria-hidden="true"></span>
        </summary>
        <ul class="turn-timeline-group-list">
          ${item.items.map((tool) => `<li>${escapeHtml(tool.content || t("turn.timeline.emptyEvent"))}</li>`).join("")}
        </ul>
      </details>
    `;
  }

  function renderTimelineHeading(item, { title = item.content } = {}) {
    return `
      <span class="turn-event-dot" aria-hidden="true"></span>
      <span class="turn-timeline-kind">${escapeHtml(kindLabel(item.type))}</span>
      <span class="turn-timeline-item-title">${escapeHtml(title || t("turn.timeline.emptyEvent"))}</span>
    `;
  }

  function renderFinalResponse(responseText, { waiting = false, phase = "final" } = {}) {
    return `
      <div class="terminal-message assistant-message ${waiting ? "is-waiting" : ""}">
        <div class="terminal-label">${escapeHtml(t("turn.timeline.assistant"))}</div>
        ${renderAssistantResponse(responseText, phase)}
      </div>
    `;
  }

  function kindLabel(type) {
    return t(`turn.timeline.kind.${type}`);
  }

  function statusClass(item) {
    return `turn-timeline-status-${item.status || "completed"}`;
  }

  return {
    renderTurnTimeline,
  };
}

// Worked for 摘要使用稳定的短格式，避免摘要行在窄屏被时间文本撑开。
export function formatTimelineDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(Number(durationMs) / 1000) || 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
