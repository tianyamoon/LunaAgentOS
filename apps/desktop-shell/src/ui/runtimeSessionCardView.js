import { formatRuntimeMessageDuration } from "./runtimeSessionMessageListView.js";

// Runtime Session Card 视图集中生成主卡片和底部 mini card。
// 状态、工作区焦点和 Turn 渲染均通过稳定接口注入，视图不直接修改 Store。
export function createRuntimeSessionCardView({
  ensureSessionStatusShape,
  normalizeWorkspaceSession,
  resolveSessionCardControlState,
  getCurrentSessionId,
  getFocusedSessionId,
  projectRuntimeSessionMessageList,
  runtimeSessionMessageListView,
  sessionCardStats,
  isSessionLatestOnly,
  sessionIdentityTitle,
  renderSessionIdentityTitle,
  renderSessionActionIcon,
  canRestoreSession,
  t,
  escapeHtml,
}) {
  function reconnectingStageLabel(stage) {
    const normalized = String(stage || "runtime").trim() || "runtime";
    const key = `restore.reconnectingStage.${normalized}`;
    const label = t(key);
    return label === key ? t("restore.reconnectingStage.runtime") : label;
  }

  // 状态图标保持紧凑，避免 Session Card 首行被长文案撑高。
  function renderSessionStatusIcon(icon) {
    const glyphs = {
      dot: "•",
      spinner: "◌",
      warning: "!",
      check: "✓",
      archive: "▣",
      lock: "⌕",
    };
    return `<span class="session-status-icon session-status-icon-${escapeHtml(icon || "dot")}" aria-hidden="true">${escapeHtml(glyphs[icon] || glyphs.dot)}</span>`;
  }

  function renderSessionStatusChip(statusView) {
    const secondary = statusView.secondary_status?.label
      ? `<span class="session-status-secondary">${escapeHtml(statusView.secondary_status.label)}</span>`
      : "";
    const activityText = renderActivityText(statusView.activity);
    const summaryText = renderSummaryText(statusView.summary);
    return `<span class="runtime-pill session-card-status-pill session-status-${escapeHtml(statusView.tone)} session-status-${escapeHtml(statusView.status)}" aria-label="${escapeHtml(t("session.statusAria", { state: statusView.label }))}" title="${escapeHtml(statusView.detail)}">
      <span>${escapeHtml(statusView.label)}${activityText}${summaryText}</span>
      ${secondary}
    </span>`;
  }

  function renderActivityText(activity) {
    if (!activity) return "";
    if (activity.kind === "thinking") return ` · ${escapeHtml(t("session.activity.thinking"))}`;
    if (activity.kind === "tool") return ` · ${escapeHtml(t("session.activity.tool", { tool: activity.text }))}`;
    if (activity.kind === "permission") return ` · ${escapeHtml(t("session.activity.permission", { detail: activity.text }))}`;
    if (activity.kind === "error") return ` · ${escapeHtml(activity.text)}`;
    return ` · ${escapeHtml(activity.text)}`;
  }

  function renderSummaryText(summary) {
    if (!summary || !summary.toolCount) return "";
    const parts = [];
    if (summary.toolCount) parts.push(t("session.summary.tools", { count: summary.toolCount }));
    if (summary.fileChangeCount) parts.push(t("session.summary.files", { count: summary.fileChangeCount }));
    if (summary.durationMs) parts.push(formatRuntimeMessageDuration(summary.durationMs));
    return parts.length ? ` · ${escapeHtml(parts.join(" · "))}` : "";
  }

  // 错误块只在状态投影提供错误时出现，避免普通会话被调试信息淹没。
  function renderSessionStatusError(statusView) {
    if (!statusView.error) return "";
    const stage = statusView.error.stage
      ? `<div class="session-status-error-stage">${escapeHtml(t("sessionStatus.errorStage", { stage: statusView.error.stage }))}</div>`
      : "";
    return `<div class="session-status-error">
      <strong>${escapeHtml(statusView.error.title)}</strong>
      ${stage}
      ${statusView.error.detail ? `<pre>${escapeHtml(statusView.error.detail)}</pre>` : ""}
      ${statusView.error.suggestion ? `<p>${escapeHtml(statusView.error.suggestion)}</p>` : ""}
    </div>`;
  }

  // 主卡片只消费投影结果，不在渲染阶段改变 Session 生命周期。
  function renderSessionCard(session) {
    ensureSessionStatusShape(session);
    const identitySession = normalizeWorkspaceSession(session);
    const controlState = resolveSessionCardControlState(session, { translate: t, canRestoreSession });
    const statusView = controlState.statusView;
    const isActiveReceiver = getCurrentSessionId() === session.id;
    const isWaiting = controlState.isWaiting;
    const managementDisabled = controlState.managementDisabled ? "disabled" : "";
    const profileMeta = [identitySession.profileName, identitySession.profileModel].filter(Boolean).join(" · ");
    const stats = sessionCardStats(session, t);
    const latestOnly = isSessionLatestOnly(session);
    const messageList = projectRuntimeSessionMessageList(session, {
      latestOnly,
      reconnectingRuntimeText: (stage) => t("restore.reconnectingRuntimeRow", {
        stage: reconnectingStageLabel(stage),
      }),
    });
    const managementTitleSuffix = controlState.managementDisabled ? t("action.restoringSuffix") : "";
    const latestOnlyLabel = latestOnly ? t("action.showAllMessages") : t("action.latestMessages");
    const isFocusedSession = getFocusedSessionId() === session.id;
    const fullscreenLabel = isFocusedSession ? t("action.exitFullscreen") : t("action.enterFullscreen");
    const identityTitle = sessionIdentityTitle(identitySession);
    const identityTitleMarkup = renderSessionIdentityTitle(identitySession);
    return `
      <article class="session-card ${isFocusedSession ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${session.id}" tabindex="0" aria-label="${escapeHtml(t("session.ariaSwitch", { title: session.title }))}" ${isActiveReceiver ? "aria-current=\"true\"" : ""}>
        <div class="session-card-header">
          <div class="session-card-row session-card-identity-line">
            <div class="session-agent-title">
              <strong title="${escapeHtml(identityTitle)}">${identityTitleMarkup}</strong>
              ${isActiveReceiver ? `<span class="active-receiver-banner">${t("session.current")}</span>` : ""}
            </div>
            <div class="session-card-actions" role="toolbar" aria-label="${t("session.actionsAria")}">
              ${controlState.canStop ? `<button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-stop-btn" data-session-id="${session.id}" title="${t("action.stop")}" aria-label="${t("action.stop")}">${renderSessionActionIcon("stop")}</button>` : ""}
              <div class="session-tool-group" role="group">
                <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="${t("action.copySession")}" aria-label="${t("action.copySession")}" ${session.turns.length ? "" : "disabled"}>${renderSessionActionIcon("copy")}</button>
                <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnlyLabel}" aria-label="${latestOnlyLabel}" ${session.turns.length > 1 ? "" : "disabled"}>${renderSessionActionIcon(latestOnly ? "all" : "latest")}</button>
                <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="${t("action.scrollLatest")}" aria-label="${t("action.scrollLatest")}">${renderSessionActionIcon("latestScroll")}</button>
                <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-fullscreen-btn ${isFocusedSession ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${isFocusedSession ? "true" : "false"}" title="${fullscreenLabel}" aria-label="${fullscreenLabel}">${renderSessionActionIcon(isFocusedSession ? "fullscreenExit" : "fullscreen")}</button>
              </div>
              <div class="session-management-group" role="group">
                <button type="button" class="mini-btn ghost-btn session-action-btn session-dismiss-btn" data-session-id="${session.id}" title="${t("action.dismiss")}${managementTitleSuffix}" aria-label="${t("action.dismiss")}" ${managementDisabled}>${renderSessionActionIcon("dismiss")}</button>
                ${controlState.canArchive ? `<button type="button" class="mini-btn ghost-btn session-action-btn session-archive-btn" data-session-id="${session.id}" title="${t("action.archive")}${managementTitleSuffix}" aria-label="${t("action.archive")}" ${managementDisabled}>${renderSessionActionIcon("archive")}</button>` : ""}
                <button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="${t("action.delete")}${managementTitleSuffix}" aria-label="${t("action.delete")}" ${managementDisabled}>${renderSessionActionIcon("delete")}</button>
                ${controlState.canRestore ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">${t("session.restoreRetry")}</button>` : ""}
              </div>
            </div>
          </div>
          <div class="session-card-row session-card-status-line">
            ${renderSessionStatusChip(statusView)}
            <div class="session-card-stats" aria-label="${t("session.statsAria")}">
              <span class="session-stat-pill">${t("session.turns", { count: session.turns.length })}</span>
              ${stats.map((item) => `<span class="session-stat-pill" data-stat-key="${escapeHtml(item.key)}">${escapeHtml(item.label)}</span>`).join("")}
            </div>
            ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
          </div>
          <div class="session-title-line" title="${escapeHtml(session.title)}" aria-label="${escapeHtml(t("session.title", { title: session.title }))}">
            <span class="session-title-label">${escapeHtml(t("session.titleLabel"))}</span>
            <span class="session-title-text">${escapeHtml(session.title)}</span>
          </div>
          ${renderSessionStatusError(statusView)}
        </div>
        <div class="session-card-body">
          ${runtimeSessionMessageListView.renderMessageListShell(messageList)}
        </div>
      </article>
    `;
  }

  // Mini Card 与主卡使用同一状态投影，确保 focused 切换时信息一致。
  function renderSessionMiniCard(session) {
    ensureSessionStatusShape(session);
    const identitySession = normalizeWorkspaceSession(session);
    const controlState = resolveSessionCardControlState(session, { translate: t, canRestoreSession });
    const statusView = controlState.statusView;
    const isActive = getCurrentSessionId() === session.id;
    const isWaiting = controlState.isWaiting;
    const titlePreview = (session.title || "").replace(/\s+/g, " ").trim();
    const previewText = titlePreview.length > 64 ? `${titlePreview.slice(0, 64)}\u2026` : titlePreview;
    const identityTitle = sessionIdentityTitle(identitySession);
    return `<button type="button" class="session-mini-card ${isActive ? "is-active" : ""} ${isWaiting ? "is-waiting" : ""}" data-session-id="${escapeHtml(session.id)}" title="${escapeHtml(identityTitle)}">
      <span class="session-mini-card-state runtime-pill session-status-${escapeHtml(statusView.tone)} session-status-${escapeHtml(statusView.status)} ${isWaiting ? "is-busy" : ""}" aria-label="${escapeHtml(statusView.label)}"></span>
      <span class="session-mini-card-body">
        <span class="session-mini-card-title">${escapeHtml(identityTitle)}</span>
        ${previewText ? `<span class="session-mini-card-title-text">${escapeHtml(previewText)}</span>` : ""}
      </span>
      <span class="session-mini-card-action" aria-hidden="true">\u21F1</span>
    </button>`;
  }

  // 流式路径：构建轻量 viewModel，避免生成完整 Card HTML。
  function buildSessionCardViewModel(session) {
    ensureSessionStatusShape(session);
    const identitySession = normalizeWorkspaceSession(session);
    const controlState = resolveSessionCardControlState(session, { translate: t, canRestoreSession });
    const statusView = controlState.statusView;
    const isActiveReceiver = getCurrentSessionId() === session.id;
    const isWaiting = controlState.isWaiting;
    const profileMeta = [identitySession.profileName, identitySession.profileModel].filter(Boolean).join(" · ");
    const stats = sessionCardStats(session, t);
    const isFocusedSession = getFocusedSessionId() === session.id;
    const identityTitle = sessionIdentityTitle(identitySession);
    const identityTitleMarkup = renderSessionIdentityTitle(identitySession);
    const managementDisabled = controlState.managementDisabled ? "disabled" : "";
    const managementTitleSuffix = controlState.managementDisabled ? t("action.restoringSuffix") : "";
    const latestOnly = isSessionLatestOnly(session);
    const latestOnlyLabel = latestOnly ? t("action.showAllMessages") : t("action.latestMessages");
    const fullscreenLabel = isFocusedSession ? t("action.exitFullscreen") : t("action.enterFullscreen");

    const className = `session-card ${isFocusedSession ? "fullscreen" : ""} ${isActiveReceiver ? "is-active-receiver" : ""} ${isWaiting ? "is-waiting" : ""}`;
    const ariaLabel = t("session.ariaSwitch", { title: session.title });
    const ariaCurrent = isActiveReceiver ? "true" : null;

    const headerHtml = `
      <div class="session-card-row session-card-identity-line">
        <div class="session-agent-title">
          <strong title="${escapeHtml(identityTitle)}">${identityTitleMarkup}</strong>
          ${isActiveReceiver ? `<span class="active-receiver-banner">${t("session.current")}</span>` : ""}
        </div>
        <div class="session-card-actions" role="toolbar" aria-label="${t("session.actionsAria")}">
          ${controlState.canStop ? `<button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-stop-btn" data-session-id="${session.id}" title="${t("action.stop")}" aria-label="${t("action.stop")}">${renderSessionActionIcon("stop")}</button>` : ""}
          <div class="session-tool-group" role="group">
            <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-copy-btn" data-session-id="${session.id}" title="${t("action.copySession")}" aria-label="${t("action.copySession")}" ${session.turns.length ? "" : "disabled"}>${renderSessionActionIcon("copy")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-latest-only-btn ${latestOnly ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${latestOnly ? "true" : "false"}" title="${latestOnlyLabel}" aria-label="${latestOnlyLabel}" ${session.turns.length > 1 ? "" : "disabled"}>${renderSessionActionIcon(latestOnly ? "all" : "latest")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-scroll-latest-btn" data-session-id="${session.id}" title="${t("action.scrollLatest")}" aria-label="${t("action.scrollLatest")}">${renderSessionActionIcon("latestScroll")}</button>
            <button type="button" class="mini-btn ghost-btn session-action-btn tool-btn session-fullscreen-btn ${isFocusedSession ? "is-on" : ""}" data-session-id="${session.id}" aria-pressed="${isFocusedSession ? "true" : "false"}" title="${fullscreenLabel}" aria-label="${fullscreenLabel}">${renderSessionActionIcon(isFocusedSession ? "fullscreenExit" : "fullscreen")}</button>
          </div>
          <div class="session-management-group" role="group">
            <button type="button" class="mini-btn ghost-btn session-action-btn session-dismiss-btn" data-session-id="${session.id}" title="${t("action.dismiss")}${managementTitleSuffix}" aria-label="${t("action.dismiss")}" ${managementDisabled}>${renderSessionActionIcon("dismiss")}</button>
            ${controlState.canArchive ? `<button type="button" class="mini-btn ghost-btn session-action-btn session-archive-btn" data-session-id="${session.id}" title="${t("action.archive")}${managementTitleSuffix}" aria-label="${t("action.archive")}" ${managementDisabled}>${renderSessionActionIcon("archive")}</button>` : ""}
            <button type="button" class="mini-btn ghost-btn session-action-btn danger-btn session-delete-btn" data-session-id="${session.id}" title="${t("action.delete")}${managementTitleSuffix}" aria-label="${t("action.delete")}" ${managementDisabled}>${renderSessionActionIcon("delete")}</button>
            ${controlState.canRestore ? `<button type="button" class="mini-btn ghost-btn session-retry-btn" data-session-id="${session.id}">${t("session.restoreRetry")}</button>` : ""}
          </div>
        </div>
      </div>
      <div class="session-card-row session-card-status-line">
        ${renderSessionStatusChip(statusView)}
        <div class="session-card-stats" aria-label="${t("session.statsAria")}">
          <span class="session-stat-pill">${t("session.turns", { count: session.turns.length })}</span>
          ${stats.map((item) => `<span class="session-stat-pill" data-stat-key="${escapeHtml(item.key)}">${escapeHtml(item.label)}</span>`).join("")}
        </div>
        ${profileMeta ? `<div class="caption session-profile-meta">${escapeHtml(profileMeta)}</div>` : ""}
      </div>
      <div class="session-title-line" title="${escapeHtml(session.title)}" aria-label="${escapeHtml(t("session.title", { title: session.title }))}">
        <span class="session-title-label">${escapeHtml(t("session.titleLabel"))}</span>
        <span class="session-title-text">${escapeHtml(session.title)}</span>
      </div>
      ${renderSessionStatusError(statusView)}
    `;

    const headerDigest = [
      identityTitle,
      isActiveReceiver,
      isWaiting,
      isFocusedSession,
      controlState.actionDigest,
      session.turns.length,
      stats.map((s) => s.key + s.label).join(","),
      profileMeta,
      session.title,
      statusView.status,
      statusView.tone,
      statusView.error?.title || "",
    ].join("|");

    return {
      className,
      ariaLabel,
      ariaCurrent,
      headerHtml,
      headerDigest,
    };
  }

  return {
    renderSessionCard,
    renderSessionMiniCard,
    buildSessionCardViewModel,
  };
}
