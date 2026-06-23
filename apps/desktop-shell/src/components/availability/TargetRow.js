import { t } from "../../i18n/index.js";
import {
  escapeHtml,
  healthReasonText,
  healthRepairText,
  healthStateClass,
  healthStateText,
  renderHealthDiagnostics,
} from "./healthText.js";

export function TargetRow(target) {
  const statusClass = healthStateClass(target.health);
  const statusText = target.sendable
    ? t("availability.sendable")
    : target.activatable
      ? t("availability.activatable")
      : healthStateText(target.health, t("availability.unavailable"));
  const currentBadge = target.isCurrent ? `<span class="current-badge">${t("availability.current")}</span>` : "";
  const subtitle = target.subtitleKey ? t(target.subtitleKey) : target.subtitle;
  const reason = healthReasonText(target.health);
  const repair = healthRepairText(target.health);

  return `
    <div class="availability-target-row ${target.isCurrent ? "is-current" : ""}">
      <div class="target-row-main">
        <strong>${escapeHtml(target.name)}</strong>
        ${currentBadge}
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      ${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}
      ${reason ? `<small class="health-message">${escapeHtml(reason)}</small>` : ""}
      ${repair ? `<small class="health-repair">${escapeHtml(repair)}</small>` : ""}
      ${renderHealthDiagnostics(target.health)}
    </div>
  `;
}
