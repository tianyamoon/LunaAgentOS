import { projectWorkspaceStatus } from "../state/workspaceStatusProjection.js";

// 顶部工作区状态条只消费领域投影，不在 main.js 或 DOM 层重新推断会话状态。
export function createWorkspaceStatusView({
  element,
  getCurrentTargetAgent,
  getCurrentTargetProvider,
  getSessionsSnapshot,
  getCurrentSession,
  getLatestActiveSessionForAgent,
  getProviderAvailability,
  sessionRecordState,
  targetDisplayName,
  providerAvailabilityLabel,
  stateClasses,
  stateDisplayLabel,
  resolveSessionCardStatusView,
  t,
  escapeHtml,
}) {
  function renderWorkspaceStatus() {
    const agent = getCurrentTargetAgent();
    const provider = getCurrentTargetProvider();
    const statusView = projectWorkspaceStatus({
      agent,
      provider,
      sessions: getSessionsSnapshot(),
      currentSession: getCurrentSession(),
      latestActiveSession: agent ? getLatestActiveSessionForAgent(agent.id) : null,
      availability: provider ? getProviderAvailability(provider.id) : null,
      sessionRecordState,
      resolveSessionStatusView: resolveSessionCardStatusView,
      translate: t,
      targetDisplayName,
    });

    if (!statusView.hasTarget) {
      element.textContent = t(statusView.placeholderKey);
      return;
    }

    const availabilityLabel = providerAvailabilityLabel(statusView.availabilitySummary, t);
    element.innerHTML = `
      <strong class="workspace-status-target">${escapeHtml(statusView.targetLabel)}</strong>
      <span class="workspace-status-separator">·</span>
      ${renderStatusPill(statusView)}
      <span class="workspace-runtime-count">${escapeHtml(availabilityLabel)}</span>
      ${statusView.liveCount > 0 ? `<span class="workspace-runtime-count">ACP × ${statusView.liveCount}</span>` : ""}
    `;
  }

  function renderStatusPill(statusView) {
    const sessionStatusView = statusView.sessionStatusView;
    if (!sessionStatusView) {
      return `<span class="state-pill workspace-state-pill ${stateClasses[statusView.statusState] || "state-idle"}">${escapeHtml(stateDisplayLabel(statusView.statusState, t))}</span>`;
    }
    const status = sessionStatusView.status || "waiting_input";
    const tone = sessionStatusView.tone || "neutral";
    const classes = [
      "state-pill",
      "workspace-state-pill",
      "runtime-pill",
      `session-status-${tone}`,
      `session-status-${status}`,
    ].join(" ");
    return `<span class="${classes}">${escapeHtml(sessionStatusView.label || "")}</span>`;
  }

  return { renderWorkspaceStatus };
}
