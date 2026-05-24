import { t } from "../../i18n/index.js";

export function RuntimeCard(instance) {
  const statusClass = instance.available ? "state-ok" : "state-error";
  const statusText = instance.available ? t("provider.available") : t("provider.unavailable");

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
    </article>
  `;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
