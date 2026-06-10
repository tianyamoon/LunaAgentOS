import { t } from "../../i18n/index.js";

export function healthStateClass(health) {
  switch (health?.overall) {
    case "available":
      return "state-ok";
    case "connectable":
    case "attention":
    case "unknown":
      return "state-warn";
    default:
      return "state-error";
  }
}

export function healthStateText(health, fallback = "") {
  if (!health?.overall) return fallback;
  return t(`availability.healthOverall.${health.overall}`);
}

export function healthReasonText(health) {
  return healthMessage("reason", health?.unavailable_reason, health?.unavailable_reason_params);
}

export function healthRepairText(health) {
  return healthMessage("repair", health?.repair_hint, health?.repair_hint_params);
}

export function renderHealthDiagnostics(health) {
  const items = Array.isArray(health?.diagnostics) ? health.diagnostics : [];
  if (!items.length) return "";
  return `
    <dl class="health-diagnostics">
      ${items.map((item) => {
        const evidence = (health.evidence || []).find((entry) => entry.field === item.field);
        return `
        <div class="health-diagnostic-item health-state-${escapeHtml(item.state)}">
          <dt>${escapeHtml(t(`availability.healthField.${item.field}`))}</dt>
          <dd>${escapeHtml(t(`availability.healthState.${item.state}`))}${evidence ? `<small>${escapeHtml(evidence.source)} · ${escapeHtml(evidence.detail)}</small>` : ""}</dd>
        </div>
      `; }).join("")}
    </dl>
  `;
}

function healthMessage(kind, code, params = {}) {
  if (!code) return "";
  if (typeof code !== "string") return "";
  const key = code.includes(".") ? code : `availability.${kind}.${code}`;
  const translated = t(key, params || {});
  return translated === key ? code : translated;
}

export function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
