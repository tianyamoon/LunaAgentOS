import { t } from "../../i18n/index.js";

export function TargetRow(target) {
  const statusClass = target.sendable ? "state-ok" : "state-error";
  const statusText = target.sendable ? t("availability.sendable") : t("availability.unavailable");
  const currentBadge = target.isCurrent ? `<span class="current-badge">${t("availability.current")}</span>` : "";
  const subtitle = target.subtitleKey ? t(target.subtitleKey) : target.subtitle;

  return `
    <div class="availability-target-row ${target.isCurrent ? "is-current" : ""}">
      <div class="target-row-main">
        <strong>${escapeHtml(target.name)}</strong>
        ${currentBadge}
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
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
