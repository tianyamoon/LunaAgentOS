import { SummaryStats } from "./SummaryStats.js";
import { ProviderSection } from "./ProviderSection.js";
import { getLanguage, t } from "../../i18n/index.js";
import { escapeHtml, healthReasonText, healthRepairText } from "./healthText.js";
import { renderRepairActions } from "./repairActions.js";
import { buildRepairActions } from "../../state/repairActions.js";

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
            .map((p) => {
              const reason = healthReasonText({
                unavailable_reason: p.reason,
                unavailable_reason_params: p.reasonParams,
              });
              const repair = healthRepairText({
                repair_hint: p.repairHint,
                repair_hint_params: p.repairHintParams,
              });
              const actions = renderRepairActions(
                buildRepairActions(
                  { repair_hint: p.repairHint, repair_hint_params: p.repairHintParams },
                  { providerId: p.providerId, instance: { commandKind: p.commandKind, command: p.command } },
                ),
              );
              return `<li><strong>${escapeHtml(p.provider)}</strong> / ${escapeHtml(p.target || p.runtime)}: ${escapeHtml(reason || t("availability.reason.unknown"))}${repair ? `<br><small>${escapeHtml(repair)}</small>` : ""}${actions}</li>`;
            })
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
