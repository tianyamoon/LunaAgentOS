export function TargetRow(target) {
  const statusClass = target.sendable ? "state-ok" : "state-error";
  const statusText = target.sendable ? "可发送" : "不可用";
  const currentBadge = target.isCurrent ? `<span class="current-badge">当前</span>` : "";

  return `
    <div class="availability-target-row ${target.isCurrent ? "is-current" : ""}">
      <div class="target-row-main">
        <strong>${escapeHtml(target.name)}</strong>
        ${currentBadge}
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      ${target.subtitle ? `<small>${escapeHtml(target.subtitle)}</small>` : ""}
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
