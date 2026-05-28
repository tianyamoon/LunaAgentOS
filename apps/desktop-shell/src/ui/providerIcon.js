export const NEUTRAL_BRAND_COLOR = "#7a7a7a";

const ADAPTER_ICON_REGISTRY = new Map();

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

export function setAdapterIcon(id, url) {
  if (!id) return;
  if (url) {
    ADAPTER_ICON_REGISTRY.set(String(id), String(url));
  } else {
    ADAPTER_ICON_REGISTRY.delete(String(id));
  }
}

export function setAdapterIconRegistry(entries) {
  ADAPTER_ICON_REGISTRY.clear();
  if (!entries) return;
  const iterable = entries instanceof Map ? entries.entries() : Object.entries(entries);
  for (const [id, url] of iterable) {
    setAdapterIcon(id, url);
  }
}

export function adapterIconUrl(id) {
  if (!id) return null;
  return ADAPTER_ICON_REGISTRY.get(String(id)) ?? null;
}

export function resolveBrandColor(provider) {
  if (!provider) return NEUTRAL_BRAND_COLOR;
  if (provider.brandColor) return provider.brandColor;
  if (provider.adapterManifest?.brandColor) return provider.adapterManifest.brandColor;
  return NEUTRAL_BRAND_COLOR;
}

export function renderProviderIcon(provider, options = {}) {
  const size = options.size || "14px";
  const url = adapterIconUrl(provider?.id);
  if (url) {
    return `<img class="provider-icon provider-icon-img provider-icon-img-color" src="${escapeHtml(url)}" alt="" style="width:${size};height:${size}" aria-hidden="true">`;
  }
  const name = provider?.name || provider?.id || "?";
  const letter = name.charAt(0).toUpperCase();
  const color = resolveBrandColor(provider);
  return `<span class="provider-icon provider-icon-fallback" style="width:${size};height:${size};--pi-color:${escapeHtml(color)}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}
