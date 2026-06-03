// User Theme Catalog 是前端访问用户主题目录的唯一 IO Seam。
export function createUserThemeCatalog({
  invoke,
  registerUserThemes,
  warn = (...args) => console.warn(...args),
} = {}) {
  async function loadUserThemes() {
    if (typeof invoke !== "function") return { themes: [], registeredCount: 0 };
    try {
      const userThemes = await invoke("load_user_themes");
      const themes = Array.isArray(userThemes) ? userThemes : [];
      if (themes.length && typeof registerUserThemes === "function") {
        registerUserThemes(themes);
      }
      return { themes, registeredCount: themes.length };
    } catch (error) {
      warn("load_user_themes failed", error);
      return { themes: [], registeredCount: 0, error };
    }
  }

  return { loadUserThemes };
}
