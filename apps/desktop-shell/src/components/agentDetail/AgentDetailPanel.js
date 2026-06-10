import { getLanguage, t } from "../../i18n/index.js";
import {
  escapeHtml,
  healthReasonText,
  healthRepairText,
  healthStateClass,
  healthStateText,
  renderHealthDiagnostics,
} from "../availability/healthText.js";
import { CAPABILITY_KEYS } from "../../providers/agentDetail.js";

function text(value) {
  if (!value) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    const language = getLanguage();
    return value[language] || value["zh-CN"] || value["en-US"] || "";
  }
  const raw = String(value);
  const translated = t(raw);
  return translated === raw ? raw : translated;
}

function itemList(items, emptyKey = "agentDetail.notConfigured") {
  const normalized = (Array.isArray(items) ? items : items ? [items] : [])
    .map(text)
    .filter(Boolean);
  if (!normalized.length) return `<p class="agent-detail-empty">${t(emptyKey)}</p>`;
  return `<ul class="agent-detail-list">${normalized.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function field(labelKey, value, emptyKey = "agentDetail.unknown") {
  const content = text(value) || t(emptyKey);
  return `
    <div class="agent-detail-field">
      <dt>${t(labelKey)}</dt>
      <dd>${escapeHtml(content)}</dd>
    </div>
  `;
}

function modelSection(models = {}) {
  const managed = models.control?.mode === "luna_managed" && (models.control.availableModels || []).length;
  const controls = managed ? `
    <div class="agent-detail-model-control">
      <label><span>${t("agentDetail.modelSelect")}</span>
        <select class="agent-default-model-select">
          ${(models.control.availableModels || []).map((model) => `<option value="${escapeHtml(model)}" ${model === models.defaultModel ? "selected" : ""}>${escapeHtml(model)}</option>`).join("")}
        </select>
      </label>
      <button type="button" class="mini-btn agent-default-model-save">${t("agentDetail.modelSave")}</button>
      <small>${t("agentDetail.modelNewSession")}</small>
    </div>
  ` : models.control?.mode === "luna_managed"
    ? `<p class="agent-detail-empty">${t("agentDetail.modelDiscoveryUnavailable")}</p>`
    : `<p class="agent-detail-empty">${t("agentDetail.modelNativeManaged")}</p>`;
  return `
    <section class="agent-detail-section">
      <h4>${t("agentDetail.models")}</h4>
      <dl class="agent-detail-grid">
        ${field("agentDetail.modelAvailable", (models.available || []).map(text).join(" / "), "agentDetail.notConfigured")}
        ${field("agentDetail.modelDefault", models.defaultModel, "agentDetail.notConfigured")}
        ${field("agentDetail.modelRecommended", (models.recommended || []).map(text).join(" / "), "agentDetail.notConfigured")}
      </dl>
      ${controls}
    </section>
  `;
}

function capabilitySection(capabilities = {}) {
  const rows = CAPABILITY_KEYS.map((key) => {
    const capability = capabilities[key] || { state: "unknown" };
    const state = capability.state || "unknown";
    const note = text(capability.noteKey || capability.note);
    return `
      <div class="agent-detail-capability">
        <dt>${t(`agentDetail.capability.${key}`)}</dt>
        <dd>
          <span class="agent-detail-capability-state is-${escapeHtml(state)}">${escapeHtml(t(`agentDetail.capabilityState.${state}`))}</span>
          ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        </dd>
      </div>
    `;
  }).join("");
  return `
    <section class="agent-detail-section">
      <h4>${t("agentDetail.capabilities")}</h4>
      <dl class="agent-detail-capability-grid">${rows}</dl>
    </section>
  `;
}

function healthSection(health) {
  if (!health) {
    return `
      <section class="agent-detail-section">
        <h4>${t("agentDetail.health")}</h4>
        <p class="agent-detail-empty">${t("agentDetail.healthUnavailable")}</p>
      </section>
    `;
  }
  const statusClass = healthStateClass(health);
  const statusText = healthStateText(health, t("availability.healthOverall.unknown"));
  const reason = healthReasonText(health);
  const repair = healthRepairText(health);
  return `
    <section class="agent-detail-section">
      <div class="agent-detail-section-head">
        <h4>${t("agentDetail.health")}</h4>
        <span class="state-pill ${statusClass}">${escapeHtml(statusText)}</span>
      </div>
      ${reason ? `<p class="health-message">${escapeHtml(reason)}</p>` : ""}
      ${repair ? `<p class="health-repair">${escapeHtml(repair)}</p>` : ""}
      ${renderHealthDiagnostics(health)}
    </section>
  `;
}

export function AgentDetailPanel(detail) {
  return `
    <article class="agent-detail-panel">
      <header class="agent-detail-hero">
        <div>
          <p class="agent-detail-kicker">${escapeHtml(detail.providerName || detail.providerId || "")}</p>
          <h3>${escapeHtml(detail.name || detail.providerName || t("agentDetail.title"))}</h3>
          ${detail.brief ? `<p>${escapeHtml(text(detail.brief))}</p>` : ""}
        </div>
      </header>

      <section class="agent-detail-section">
        <h4>${t("agentDetail.identity")}</h4>
        <dl class="agent-detail-grid">
          ${field("agentDetail.name", detail.name)}
          ${field("agentDetail.provider", detail.providerName)}
          ${field("agentDetail.profile", detail.profile, "agentDetail.notConfigured")}
          ${field("agentDetail.account", detail.accountIdentity, "agentDetail.unknown")}
          ${field("agentDetail.runtime", detail.runtimeEnvironment)}
          ${field("agentDetail.defaultWorkingDirectory", detail.defaultWorkingDirectory, "agentDetail.notConfigured")}
        </dl>
      </section>

      ${modelSection(detail.models)}
      ${capabilitySection(detail.capabilities)}
      ${healthSection(detail.health)}

      <section class="agent-detail-section">
        <h4>${t("agentDetail.safety")}</h4>
        ${itemList(detail.safety, "agentDetail.safetyDefault")}
      </section>

      <section class="agent-detail-section">
        <h4>${t("agentDetail.bestPractices")}</h4>
        ${itemList(detail.bestPractices, "agentDetail.bestPracticeDefault")}
      </section>
    </article>
  `;
}
