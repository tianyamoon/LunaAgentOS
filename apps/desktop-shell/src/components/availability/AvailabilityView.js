import { SummaryStats } from "./SummaryStats.js";
import { ProviderSection } from "./ProviderSection.js";

export function AvailabilityView(data, options = {}) {
  const { summary, providers, problems, lastCheck } = data;
  const { showTitle = true, compact = false } = options;

  const titleHtml = showTitle
    ? `<header class="availability-header">
        <h2>系统可用性</h2>
        <p>检查 Provider、Runtime 与 Agent 的可用状态</p>
      </header>`
    : "";

  const summaryHtml = SummaryStats(data);

  const providersHtml = providers
    .map((provider) => ProviderSection(provider))
    .join("");

  const problemsHtml = problems.length
    ? `<section class="availability-problems">
        <h4>需要关注 (${problems.length})</h4>
        <ul>
          ${problems
            .map(
              (p) =>
                `<li><strong>${escapeHtml(p.provider)}</strong> / ${escapeHtml(p.target || p.runtime)}: ${escapeHtml(p.reason)}</li>`
            )
            .join("")}
        </ul>
      </section>`
    : "";

  const footerHtml = lastCheck
    ? `<footer class="availability-footer">
        <span>最后检查: ${new Date(lastCheck).toLocaleTimeString("zh-CN")}</span>
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
