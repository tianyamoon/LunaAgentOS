export function compactNoticeText(value, maxLength = 180) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function createAppNoticeController({ element = null } = {}) {
  function set(message, tone = "muted") {
    if (!element) return;
    // 顶部通知只表达全局状态，不承载业务判断；调用方传入已本地化文案。
    element.textContent = message;
    element.classList.toggle("is-busy", tone === "busy");
    element.classList.toggle("is-error", tone === "error");
  }

  return {
    set,
    compact: compactNoticeText,
  };
}
