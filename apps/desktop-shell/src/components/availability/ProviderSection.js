import { RuntimeCard } from "./RuntimeCard.js";
import { TargetRow } from "./TargetRow.js";
import { t } from "../../i18n/index.js";

export function ProviderSection(provider) {
  const instancesHtml = provider.instances
    .map((instance) => RuntimeCard(instance))
    .join("");

  const targetsHtml = provider.targets
    .map((target) => TargetRow(target))
    .join("");

  const statusClass = provider.available ? "state-ok" : "state-error";
  const statusText = provider.availabilitySummary === "available"
    ? t("provider.available")
    : provider.availabilitySummary === "partial"
      ? t("provider.partial")
      : t("provider.unavailable");

  return `
    <section class="availability-provider-section">
      <header class="availability-provider-header">
        <h3>${escapeHtml(provider.name)}</h3>
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </header>
      ${instancesHtml ? `<div class="availability-runtimes">${instancesHtml}</div>` : ""}
      ${targetsHtml ? `<div class="availability-targets">${targetsHtml}</div>` : ""}
    </section>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
