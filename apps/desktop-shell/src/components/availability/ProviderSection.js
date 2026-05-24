import { RuntimeCard } from "./RuntimeCard.js";
import { TargetRow } from "./TargetRow.js";

export function ProviderSection(provider) {
  const instancesHtml = provider.instances
    .map((instance) => RuntimeCard(instance))
    .join("");

  const targetsHtml = provider.targets
    .map((target) => TargetRow(target))
    .join("");

  const statusClass = provider.available ? "state-ok" : "state-error";
  const statusText = provider.availabilitySummary === "available" ? "可用" : provider.availabilitySummary === "partial" ? "部分可用" : "不可用";

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
