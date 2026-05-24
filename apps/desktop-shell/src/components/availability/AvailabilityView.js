import { SummaryStats } from "./SummaryStats.js";
import { ProviderSection } from "./ProviderSection.js";
import { getLanguage, t } from "../../i18n/index.js";

export function AvailabilityView(data, options = {}) {
  const { summary, providers, problems, lastCheck } = data;
  const { showTitle = true, compact = false } = options;

  const titleHtml = showTitle
    ? `<header class="availability-header">
        <h2>${t("availability.title")}</h2>
        <p>${t("availability.subtitle")}</p>
      </header>`
    : "";

  const summaryHtml = SummaryStats(data);

  const providersHtml = providers
    .map((provider) => ProviderSection(provider))
    .join("");

  const problemsHtml = problems.length
    ? `<section class="availability-problems">
        <h4>${t("availability.needsAttention")} (${problems.length})</h4>
        <ul>
          ${problems
            .map(
              (p) =>
                `<li><strong>${escapeHtml(p.provider)}</strong> / ${escapeHtml(p.target || p.runtime)}: ${escapeHtml(p.reasonKey ? t(p.reasonKey) : p.reason)}</li>`
            )
            .join("")}
        </ul>
      </section>`
    : "";

  const footerHtml = lastCheck
    ? `<footer class="availability-footer">
        <span>${t("availability.lastCheck", { time: new Date(lastCheck).toLocaleTimeString(getLanguage()) })}</span>
      </footer>`
    : "";

  return `
    <div class="availability-view ${compact ? "is-compact" : ""}">
      ${titleHtml}
      ${summaryHtml}
      ${providersHtml}
      ${problemsHtml}
      ${footerHtml}
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
