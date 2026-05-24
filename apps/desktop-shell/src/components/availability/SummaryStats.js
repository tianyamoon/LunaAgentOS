export function SummaryStats(data) {
  const { summary, currentTarget } = data;

  const currentTargetHtml = currentTarget
    ? `<div class="summary-current-target">
        <span class="summary-label">当前目标</span>
        <strong>${escapeHtml(currentTarget.displayName)}</strong>
        <span class="state-pill ${currentTarget.sendable ? "state-ok" : "state-error"}">
          ${currentTarget.sendable ? "可发送" : "不可发送"}
        </span>
      </div>`
    : "";

  return `
    <div class="summary-stats">
      <div class="summary-card">
        <span class="summary-number">${summary.providers.available}/${summary.providers.total}</span>
        <span class="summary-label">Provider</span>
      </div>
      <div class="summary-card">
        <span class="summary-number">${summary.runtimes.available}/${summary.runtimes.total}</span>
        <span class="summary-label">Runtime</span>
      </div>
      <div class="summary-card">
        <span class="summary-number">${summary.targets.sendable}/${summary.targets.total}</span>
        <span class="summary-label">Agent</span>
      </div>
      ${currentTargetHtml}
    </div>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
