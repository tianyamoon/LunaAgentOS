// Provider icon rendering — maps provider iconSlug to an SVG asset path or first-letter fallback.
// Icon assets live in src/assets/provider-icons/{slug}.svg.
// Dynamic adapters can specify an iconSlug in their manifest to reuse a registered icon.

/**
 * Registry of built-in icon slugs → relative path to SVG asset (from src/).
 * Extend this object when adding new provider icon files.
 */
const ICON_REGISTRY = {
  anthropic: "./assets/provider-icons/anthropic.svg",
  openai: "./assets/provider-icons/openai.svg",
  bytedance: "./assets/provider-icons/bytedance.svg",
};

/**
 * Built-in mapping: providerId → { iconSlug, brandColor }.
 * Used when provider object itself doesn't carry iconSlug / brandColor.
 */
const BUILTIN_ICON_META = {
  claude: { iconSlug: "anthropic", brandColor: "#D4A27F" },
  codex: { iconSlug: "openai", brandColor: "#412991" },
  hermes: { iconSlug: null, brandColor: "#40B4A6" },
  trae: { iconSlug: "bytedance", brandColor: "#325AB4" },
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

/**
 * Resolve the icon slug for a provider.
 * Priority: provider.iconSlug > provider.adapterManifest.iconSlug > BUILTIN_ICON_META[id]
 */
export function resolveIconSlug(provider) {
  if (!provider) return null;
  if (provider.iconSlug) return provider.iconSlug;
  if (provider.adapterManifest?.iconSlug) return provider.adapterManifest.iconSlug;
  return BUILTIN_ICON_META[provider.id]?.iconSlug ?? null;
}

/**
 * Resolve the brand color for a provider.
 */
export function resolveBrandColor(provider) {
  if (!provider) return "#666";
  if (provider.brandColor) return provider.brandColor;
  if (provider.adapterManifest?.brandColor) return provider.adapterManifest.brandColor;
  return BUILTIN_ICON_META[provider.id]?.brandColor ?? "#666";
}

/**
 * Get the asset path for a given slug, or null if not registered.
 */
export function iconPathForSlug(slug) {
  return ICON_REGISTRY[slug] ?? null;
}

/**
 * Render a provider icon as an HTML string.
 * Returns an <img> when the slug has a registered asset path,
 * or a first-letter fallback span otherwise.
 *
 * @param {object} provider - Provider object (from providersStore)
 * @param {object} [options]
 * @param {string} [options.size] - CSS size override (default "14px")
 * @returns {string} HTML string
 */
export function renderProviderIcon(provider, options = {}) {
  const size = options.size || "14px";
  const slug = resolveIconSlug(provider);
  const path = slug ? iconPathForSlug(slug) : null;
  if (path) {
    return `<img class="provider-icon provider-icon-img" src="${escapeHtml(path)}" alt="" style="width:${size};height:${size}" aria-hidden="true">`;
  }
  const name = provider?.name || provider?.id || "?";
  const letter = name.charAt(0).toUpperCase();
  const color = resolveBrandColor(provider);
  return `<span class="provider-icon provider-icon-fallback" style="width:${size};height:${size};--pi-color:${escapeHtml(color)}" aria-hidden="true">${escapeHtml(letter)}</span>`;
}
