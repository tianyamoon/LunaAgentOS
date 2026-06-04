import { projectWorkspaceStatus } from "../state/workspaceStatusProjection.js";

// 顶部工作区状态条只负责把领域投影写入 DOM，避免 main.js 直接拼 UI。
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
      <span class="state-pill workspace-state-pill ${stateClasses[statusView.statusState] || "state-idle"}">${escapeHtml(stateDisplayLabel(statusView.statusState, t))}</span>
      <span class="workspace-runtime-count">${escapeHtml(availabilityLabel)}</span>
      ${statusView.liveCount > 0 ? `<span class="workspace-runtime-count">ACP × ${statusView.liveCount}</span>` : ""}
    `;
  }

  return { renderWorkspaceStatus };
}
