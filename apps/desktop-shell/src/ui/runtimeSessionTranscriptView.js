// Runtime Session Transcript View 模块。
// 最新轮保持展开，历史轮默认收敛，排队输入单独呈现，避免 Card 继续堆叠为日志盒子。

export function createRuntimeSessionTranscriptView({
  turnTimelineView,
  isTurnCollapsed,
  clearTurnDetailOpenState,
  turnResponseText,
  statusFromRuntimeStateCode,
  isRunningTurnStatus,
  turnStatusClasses,
  turnStatusLabel,
  renderTurnCollapseIcon,
  TURN_STATUS,
  t,
  escapeHtml,
}) {
  const previousStreamingByTurnId = new Map();

  function collapsedSummary(turn) {
    const source = [turn.task, turnResponseText(turn)].filter(Boolean).join(" · ");
    const compact = source.replace(/\s+/g, " ").trim();
    if (!compact) return t("turn.collapsedEmpty");
    return compact.length > 108 ? `${compact.slice(0, 108)}...` : compact;
  }

  // Turn 的展开偏好允许传入默认值：最新轮展开，历史轮默认折叠。
  function renderTurn(turn, index, { defaultCollapsed = false } = {}) {
    const turnStatus = turn.status || statusFromRuntimeStateCode(turn.state, Boolean(turn.finalResponse));
    const streaming = isRunningTurnStatus(turnStatus);
    const rawResponseText = turnResponseText(turn);
    const responseText = rawResponseText || t("turn.waiting");
    const previousStreaming = previousStreamingByTurnId.get(turn.id);
    if (previousStreaming === true && !streaming) clearTurnDetailOpenState(turn.id);
    previousStreamingByTurnId.set(turn.id, streaming);
    const collapsed = isTurnCollapsed(turn.id, defaultCollapsed);
    const turnToggleLabel = collapsed ? t("action.expandTurn") : t("action.collapseTurn");
    const timelineHtml = turnTimelineView.renderTurnTimeline(turn, {
      streaming,
      failed: turnStatus === TURN_STATUS.failed,
      responseText,
      rawResponseText,
    });
    const historyIntegrityWarning = turn.meta?.historyIntegrity === "legacy_unverified"
      ? `<p class="turn-history-integrity-warning">${escapeHtml(t("turn.historyIntegrityWarning"))}</p>`
      : "";
    return `
      <section class="turn-block ${collapsed ? "is-collapsed" : ""}" data-turn-id="${escapeHtml(turn.id)}">
        <div class="turn-header">
          <div class="turn-title">
            <button type="button" class="mini-btn ghost-btn turn-collapse-btn ${collapsed ? "is-on" : ""}" data-turn-id="${escapeHtml(turn.id)}" data-default-collapsed="${defaultCollapsed ? "true" : "false"}" aria-expanded="${collapsed ? "false" : "true"}" title="${turnToggleLabel}" aria-label="${turnToggleLabel}">
              ${renderTurnCollapseIcon(collapsed)}
            </button>
            <strong>${t("turn.title", { index: index + 1 })}</strong>
          </div>
          <div class="turn-header-actions">
            <span class="state-pill ${turnStatusClasses[turnStatus] || "turn-status-created"}">${escapeHtml(turnStatusLabel(turnStatus))}</span>
            <button type="button" class="mini-btn ghost-btn turn-copy-btn" data-turn-id="${escapeHtml(turn.id)}">${t("turn.copyTurn")}</button>
            <button type="button" class="mini-btn ghost-btn turn-copy-response-btn" data-turn-id="${escapeHtml(turn.id)}" ${rawResponseText ? "" : "disabled"}>${t("turn.copyResponse")}</button>
          </div>
        </div>
        ${historyIntegrityWarning}
        ${collapsed
          ? `<div class="turn-collapsed-summary">${escapeHtml(collapsedSummary(turn))}</div>`
          : `
            <div class="terminal-message user-message">
              <p>${escapeHtml(turn.task)}</p>
            </div>
            ${renderTurnAttachments(turn)}
            ${timelineHtml}
          `}
      </section>
    `;
  }

  function renderQueuedSubmissions(submissions) {
    if (!submissions.length) return "";
    return `
      <section class="session-follow-up-queue" aria-label="${escapeHtml(t("session.followUpQueueAria"))}">
        <div class="session-follow-up-queue-title">${escapeHtml(t("session.followUpQueueTitle", { count: submissions.length }))}</div>
        ${submissions.map((submission) => `
          <div class="session-follow-up-item">
            <span>${escapeHtml(submission.task)}</span>
            ${submission.attachmentCount ? `<small>${escapeHtml(t("session.followUpAttachmentCount", { count: submission.attachmentCount }))}</small>` : ""}
          </div>
        `).join("")}
      </section>
    `;
  }

  // 附件正文只进入 runtime prompt；卡片显示轻量证据，便于用户确认本轮实际携带了什么。
  function renderTurnAttachments(turn) {
    const attachments = Array.isArray(turn.meta?.attachments) ? turn.meta.attachments : [];
    if (!attachments.length) return "";
    return `
      <div class="turn-attachment-strip" aria-label="${escapeHtml(t("turn.attachment.aria"))}">
        ${attachments.map((attachment) => `
          <span class="turn-attachment-chip is-${escapeHtml(attachment.status || "metadata")}">
            <span class="turn-attachment-name">${escapeHtml(attachment.name || t("turn.attachment.unnamed"))}</span>
            <small>${escapeHtml(t(`turn.attachment.${attachment.status || "metadata"}`))}</small>
          </span>
        `).join("")}
      </div>
    `;
  }

  // latest-only 仍受原有开关控制；默认 all 模式下历史轮以紧凑摘要出现。
  function renderTranscript(projection, { latestOnly = false, latestAnchor = "" } = {}) {
    const previousTurns = latestOnly ? [] : projection.previousTurns;
    const hiddenCount = latestOnly ? projection.previousTurns.length : 0;
    const latestIndex = projection.previousTurns.length;
    const hasContent = previousTurns.length || projection.latestTurn || projection.queuedSubmissions.length;
    if (!hasContent) return `<p class="flow-empty">${escapeHtml(t("session.noMessages"))}</p>`;
    const turnHtml = [
      hiddenCount ? `<div class="session-hidden-turns">${escapeHtml(t("session.hiddenTurns", { count: hiddenCount }))}</div>` : "",
      ...previousTurns.map(({ turn, index }) => renderTurn(turn, index, { defaultCollapsed: true })),
      projection.latestTurn ? renderTurn(projection.latestTurn, latestIndex) : "",
      renderQueuedSubmissions(projection.queuedSubmissions),
      `<div class="session-latest-anchor">${escapeHtml(latestAnchor)}</div>`,
    ].join("");
    return turnHtml;
  }

  return {
    renderTranscript,
    renderTurn,
  };
}
