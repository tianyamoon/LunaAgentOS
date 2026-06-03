import test from "node:test";
import assert from "node:assert/strict";

import { createAppChromeController } from "./appChromeController.js";

function makeDocument() {
  const styles = new Map();
  const classes = new Map();
  return {
    title: "",
    documentElement: {
      lang: "",
      dataset: {},
      style: {
        setProperty: (name, value) => styles.set(name, value),
      },
      classList: {
        toggle: (name, value) => classes.set(name, value),
      },
      styles,
      classes,
    },
  };
}

function makeHarness() {
  const documentRef = makeDocument();
  const calls = [];
  let language = "zh-CN";
  let fontScaleId = "default";
  let themeId = "dark";
  const fontScaleBtn = {};
  const themeBtn = {};
  const languageBtn = {};
  const providerManagerBtn = {};
  const themes = [
    { id: "dark", colorScheme: "dark", vars: { "--surface": "#111" }, labelKey: "dark" },
    { id: "light", colorScheme: "light", vars: { "--surface": "#fff" }, labelKey: "light" },
  ];
  const controller = createAppChromeController({
    documentRef,
    providerManagerBtn,
    languageBtn,
    fontScaleBtn,
    themeBtn,
    appPreferences: {
      getFontScaleId: () => fontScaleId,
      setFontScaleId: (next) => { fontScaleId = next; calls.push(["font", next]); },
      getThemeId: () => themeId,
      setThemeId: (next) => { themeId = next; calls.push(["theme", next]); },
    },
    userThemeCatalog: {
      loadUserThemes: async () => ({ registeredCount: 1 }),
    },
    applyDataI18n: () => calls.push(["i18n"]),
    getLanguage: () => language,
    t: (key, params = {}) => (params.name ? `${key}:${params.name}` : key),
    toggleLanguagePreference: () => { language = language === "zh-CN" ? "en-US" : "zh-CN"; },
    fontScaleOptions: [
      { id: "compact", labelKey: "font.compact", scale: 0.92 },
      { id: "default", labelKey: "font.default", scale: 1 },
      { id: "comfortable", labelKey: "font.comfortable", scale: 1.08 },
    ],
    findTheme: (id) => themes.find((theme) => theme.id === id) || null,
    nextThemeId: (id) => (id === "dark" ? "light" : "dark"),
    defaultThemeId: "dark",
    themes,
    themeLabel: (theme) => theme.id,
    afterStaticTranslations: () => calls.push(["static"]),
    afterLanguageChanged: () => calls.push(["languageChanged"]),
  });
  return { controller, documentRef, calls, fontScaleBtn, themeBtn, languageBtn, providerManagerBtn };
}

test("appChromeController: 应用静态翻译时同步字体主题与顶栏", () => {
  const { controller, documentRef, calls, fontScaleBtn, themeBtn, languageBtn, providerManagerBtn } = makeHarness();

  controller.applyStaticTranslations();

  assert.equal(documentRef.documentElement.lang, "zh-CN");
  assert.equal(documentRef.title, "app.title");
  assert.equal(providerManagerBtn.textContent, "availability.button");
  assert.equal(languageBtn.textContent, "topbar.language");
  assert.equal(fontScaleBtn.textContent, "font.default");
  assert.equal(themeBtn.textContent, "topbar.theme:dark");
  assert.equal(documentRef.documentElement.styles.get("--surface"), "#111");
  assert.equal(documentRef.documentElement.classes.get("theme-dark"), true);
  assert.deepEqual(calls.filter(([kind]) => kind === "static"), [["static"]]);
});

test("appChromeController: 字体和主题循环会写入偏好", () => {
  const { controller, calls } = makeHarness();

  controller.cycleFontScale();
  controller.cycleTheme();

  assert.ok(calls.some((call) => call[0] === "font" && call[1] === "comfortable"));
  assert.ok(calls.some((call) => call[0] === "theme" && call[1] === "light"));
});

test("appChromeController: 切换语言会刷新静态文案和外部视图", () => {
  const { controller, documentRef, calls } = makeHarness();

  controller.toggleLanguage();

  assert.equal(documentRef.documentElement.lang, "en-US");
  assert.ok(calls.some(([kind]) => kind === "languageChanged"));
});

test("appChromeController: 用户主题加载后重新应用主题", async () => {
  const { controller, documentRef } = makeHarness();

  await controller.loadUserThemes();

  assert.equal(documentRef.documentElement.dataset.theme, "dark");
});
