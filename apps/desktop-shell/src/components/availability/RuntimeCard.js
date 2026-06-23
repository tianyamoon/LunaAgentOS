import { t } from "../../i18n/index.js";
import {
  escapeHtml,
  healthReasonText,
  healthRepairText,
  healthStateClass,
  healthStateText,
  renderHealthDiagnostics,
} from "./healthText.js";

export function RuntimeCard(instance) {
  const statusClass = healthStateClass(instance.health);
  const statusText = instance.available ? t("provider.available") : healthStateText(instance.health, t("provider.unavailable"));
  const reason = healthReasonText(instance.health);
  const repair = healthRepairText(instance.health);

  const detailHtml = instance.detail
    ? `<small>${escapeHtml(instance.detail)}</small>`
    : "";

  const versionHtml = instance.version
    ? `<small class="runtime-version">${escapeHtml(instance.version)}</small>`
    : "";

  return `
    <article class="availability-runtime-card">
      <div class="runtime-card-header">
        <strong>${escapeHtml(instance.runtimeLabel)}</strong>
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      ${instance.summary ? `<p>${escapeHtml(instance.summary)}</p>` : ""}
      ${detailHtml}
      ${versionHtml}
      ${reason ? `<p class="health-message">${escapeHtml(reason)}</p>` : ""}
      ${repair ? `<p class="health-repair">${escapeHtml(repair)}</p>` : ""}
      ${renderHealthDiagnostics(instance.health)}
    </article>
  `;
}
