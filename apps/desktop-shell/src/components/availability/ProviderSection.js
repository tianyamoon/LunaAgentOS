import { RuntimeCard } from "./RuntimeCard.js";
import { TargetRow } from "./TargetRow.js";
import { t } from "../../i18n/index.js";
import {
  escapeHtml,
  healthReasonText,
  healthRepairText,
  healthStateClass,
  healthStateText,
  renderHealthDiagnostics,
} from "./healthText.js";

export function ProviderSection(provider) {
  const instancesHtml = provider.instances
    .map((instance) => RuntimeCard(instance))
    .join("");

  const targetsHtml = provider.targets
    .map((target) => TargetRow(target))
    .join("");

  const statusClass = healthStateClass(provider.health) || (provider.available ? "state-ok" : "state-error");
  const statusText = provider.availabilitySummary === "available"
    ? t("provider.available")
    : provider.availabilitySummary === "partial"
      ? t("provider.partial")
      : healthStateText(provider.health, t("provider.unavailable"));
  const reason = healthReasonText(provider.health);
  const repair = healthRepairText(provider.health);

  return `
    <section class="availability-provider-section">
      <header class="availability-provider-header">
        <h3>${escapeHtml(provider.name)}</h3>
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </header>
      ${reason ? `<p class="health-message">${escapeHtml(reason)}</p>` : ""}
      ${repair ? `<p class="health-repair">${escapeHtml(repair)}</p>` : ""}
      ${renderHealthDiagnostics(provider.health)}
      ${instancesHtml ? `<div class="availability-runtimes">${instancesHtml}</div>` : ""}
      ${targetsHtml ? `<div class="availability-targets">${targetsHtml}</div>` : ""}
    </section>
  `;
}
