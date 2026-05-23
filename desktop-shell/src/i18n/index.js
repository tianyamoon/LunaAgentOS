// i18n facade for LunaAgentOS desktop shell.
//
// Exposes:
// - t(key, params): canonical translator backed by translations dictionary
//   with safe fallback to zh-CN, then to the raw key.
// - getLanguage / setLanguage / toggleLanguage: language state with
//   localStorage persistence.
// - applyDataI18n(root): rewrites text content / aria labels for any
//   element under root that carries [data-i18n] / [data-i18n-aria-label].
//   Pure DOM utility; no business hooks (callers handle their own
//   re-render + label refresh).
//
// All language state lives in this module so business code can never
// hold a stale `languageId` snapshot.

import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "./translations.js";

export const LANGUAGE_KEY = "lunaagentos.language";

let currentLanguage = readPersistedLanguage();

function readPersistedLanguage() {
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(LANGUAGE_KEY) : null;
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  } catch (_) {
    // ignore storage errors (privacy mode etc.)
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(language) {
  if (!SUPPORTED_LANGUAGES.includes(language)) return currentLanguage;
  currentLanguage = language;
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANGUAGE_KEY, language);
  } catch (_) {
    // ignore storage errors
  }
  return currentLanguage;
}

export function toggleLanguage() {
  const next = currentLanguage === "zh-CN" ? "en-US" : "zh-CN";
  return setLanguage(next);
}

export function t(key, params = {}) {
  const table = translations[currentLanguage] || translations[DEFAULT_LANGUAGE];
  const template = table[key] || translations[DEFAULT_LANGUAGE][key] || key;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    template,
  );
}

export function applyDataI18n(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
  root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  });
}

export { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE };
