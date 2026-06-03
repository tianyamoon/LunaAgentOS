export function createAppChromeController({
  documentRef = document,
  providerManagerBtn = null,
  languageBtn = null,
  fontScaleBtn = null,
  themeBtn = null,
  appPreferences,
  userThemeCatalog,
  applyDataI18n,
  getLanguage,
  t,
  toggleLanguagePreference,
  fontScaleOptions = [],
  findTheme,
  nextThemeId,
  defaultThemeId,
  themes = [],
  themeLabel,
  afterStaticTranslations = () => {},
  afterLanguageChanged = () => {},
} = {}) {
  let fontScaleId = appPreferences?.getFontScaleId?.() || fontScaleOptions[0]?.id || "default";
  let themeId = appPreferences?.getThemeId?.() || defaultThemeId;

  function currentFontScaleOption() {
    return fontScaleOptions.find((item) => item.id === fontScaleId) || fontScaleOptions[1] || fontScaleOptions[0];
  }

  function applyFontScale() {
    const option = currentFontScaleOption();
    if (!option) return;
    documentRef.documentElement.style.setProperty("--ui-scale", String(option.scale));
    if (fontScaleBtn) fontScaleBtn.textContent = t(option.labelKey);
  }

  function cycleFontScale() {
    const index = fontScaleOptions.findIndex((item) => item.id === fontScaleId);
    const next = fontScaleOptions[(index + 1) % fontScaleOptions.length] || currentFontScaleOption();
    if (!next) return;
    fontScaleId = next.id;
    appPreferences?.setFontScaleId?.(fontScaleId);
    applyFontScale();
  }

  function currentTheme() {
    return findTheme?.(themeId) || findTheme?.(defaultThemeId) || themes[0];
  }

  // 主题变量只从主题注册表写入，避免视图层写死颜色。
  function applyTheme() {
    const theme = currentTheme();
    if (!theme) return;
    const root = documentRef.documentElement;
    Object.entries(theme.vars || {}).forEach(([name, value]) => {
      if (name && value !== undefined && value !== null) {
        root.style.setProperty(name, String(value));
      }
    });
    if (theme.colorScheme) root.style.setProperty("color-scheme", theme.colorScheme);
    root.classList.toggle("theme-dark", theme.colorScheme === "dark");
    root.classList.toggle("theme-light", theme.colorScheme !== "dark");
    root.dataset.theme = theme.id;
    if (themeBtn) {
      themeBtn.textContent = t("topbar.theme", { name: themeLabel(theme, getLanguage()) });
    }
  }

  function cycleTheme() {
    themeId = nextThemeId(themeId);
    appPreferences?.setThemeId?.(themeId);
    applyTheme();
  }

  function applyStaticTranslations() {
    const lang = getLanguage();
    documentRef.documentElement.lang = lang;
    applyDataI18n(documentRef);
    documentRef.title = t("app.title");
    if (providerManagerBtn) providerManagerBtn.textContent = t("availability.button");
    if (languageBtn) languageBtn.textContent = t("topbar.language");
    applyFontScale();
    applyTheme();
    afterStaticTranslations();
  }

  function toggleLanguage() {
    toggleLanguagePreference();
    applyStaticTranslations();
    afterLanguageChanged();
  }

  async function loadUserThemes() {
    const result = await userThemeCatalog.loadUserThemes();
    if (result.registeredCount > 0) applyTheme();
    return result;
  }

  return {
    applyStaticTranslations,
    applyFontScale,
    applyTheme,
    cycleFontScale,
    cycleTheme,
    toggleLanguage,
    loadUserThemes,
    currentFontScaleOption,
    currentTheme,
  };
}
