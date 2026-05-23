// HTML escape and link safety helpers used by the markdown renderer and
// every direct template literal in main.js. Pure string in / string out.

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_PROTOCOL_PATTERN = /^(https?:|mailto:|file:)/i;

export function safeLinkHref(value) {
  const href = String(value || "").trim();
  if (!SAFE_PROTOCOL_PATTERN.test(href)) return "";
  return escapeHtml(href);
}
