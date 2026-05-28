// Theme registry for LunaAgentOS desktop shell.
//
// Bundled themes are auto-discovered via `import.meta.glob` from every
// *.json sibling in this directory: adding a new built-in theme is
// literally "drop a file in src/themes/" with no edit here.
//
// User themes are loaded at runtime from the Tauri side via
// `load_user_themes` (~/.lunaagentos/themes/*.json on disk). The shell
// calls `registerUserThemes()` after the async load; the public THEMES
// array is mutated in place so any reader gets the up-to-date list on
// the next read.
//
// Theme JSON shape (validated leniently — unknown fields are ignored):
// {
//   "id": "<stable-id>",
//   "label": { "zh-CN": "...", "en-US": "..." },
//   "colorScheme": "light" | "dark",
//   "vars": { "--token": "value", ... }
// }
//
// Recognised vars (theme may override any subset; unset vars fall back
// to the :root defaults in styles.css):
//   --bg, --panel, --panel-strong, --border, --text, --muted,
//   --accent, --accent-soft, --shadow,
//   --thinking, --tooling, --done, --error,
//   --scrollbar-thumb, --scrollbar-thumb-hover, --scrollbar-thumb-active,
//   --surface-raised-rgb, --accent-tint-from, --accent-tint-to,
//   --code-text, --terminal-muted, --inline-code, --blockquote-text,
//   --label-warm, --mini-card-title,
//   --brand-logo-filter, --composer-bg, --composer-input-bg,
//   --body-background.

const bundledModules = import.meta.glob("./*.json", { eager: true, import: "default" });

// Preferred display order for shipped built-in themes. Themes not listed
// here (user themes, future built-ins) sort alphabetically after these.
const DISPLAY_ORDER = ["light", "dark-neutral", "dark-warm", "dark-high-contrast"];

export const DEFAULT_THEME_ID = "light";

function isValidTheme(value) {
  if (!value || typeof value !== "object") return false;
  if (typeof value.id !== "string" || !value.id) return false;
  if (!value.vars || typeof value.vars !== "object") return false;
  return true;
}

function compareThemes(a, b) {
  const ia = DISPLAY_ORDER.indexOf(a.id);
  const ib = DISPLAY_ORDER.indexOf(b.id);
  if (ia === -1 && ib === -1) return String(a.id).localeCompare(String(b.id));
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

const bundledThemes = Object.values(bundledModules)
  .filter(isValidTheme)
  .map((theme) => ({ ...theme, source: theme.source || "builtin" }));

// Public mutable array. Callers MUST read findTheme/nextThemeId/THEMES
// each time rather than capture stale references; user-theme registration
// mutates this list in place.
export const THEMES = [...bundledThemes].sort(compareThemes);

export function findTheme(id) {
  return THEMES.find((theme) => theme.id === id) || null;
}

export function themeLabel(theme, language) {
  if (!theme) return "";
  const label = theme.label || {};
  return label[language] || label["en-US"] || label["zh-CN"] || theme.id;
}

export function nextThemeId(currentId) {
  if (!THEMES.length) return DEFAULT_THEME_ID;
  const index = THEMES.findIndex((theme) => theme.id === currentId);
  const nextIndex = (index + 1) % THEMES.length;
  return THEMES[nextIndex].id;
}

// Merge runtime-supplied user themes (e.g. from ~/.lunaagentos/themes/).
// User themes override built-ins of the same id; new ids are appended.
// The public THEMES array is mutated in place to preserve any references
// callers might hold.
export function registerUserThemes(userThemes) {
  if (!Array.isArray(userThemes) || !userThemes.length) return THEMES;
  const cleaned = userThemes
    .filter(isValidTheme)
    .map((theme) => ({ ...theme, source: "user" }));
  const userIds = new Set(cleaned.map((theme) => theme.id));
  // Remove built-ins that the user shadowed.
  for (let i = THEMES.length - 1; i >= 0; i--) {
    if (THEMES[i].source !== "user" && userIds.has(THEMES[i].id)) {
      THEMES.splice(i, 1);
    }
  }
  // Remove existing user entries with the same id (idempotent re-register).
  for (let i = THEMES.length - 1; i >= 0; i--) {
    if (THEMES[i].source === "user" && userIds.has(THEMES[i].id)) {
      THEMES.splice(i, 1);
    }
  }
  THEMES.push(...cleaned);
  THEMES.sort(compareThemes);
  return THEMES;
}
