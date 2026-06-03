// 后端错误码格式化集中在一个 Module，避免各 Controller 重复解析。
export function formatBackendError(error, translate = null) {
  const raw = String(error);
  const match = raw.match(/^\[([A-Z_]+)\]\s*(.*)$/);
  if (!match) return raw;
  const [, code, message] = match;
  if (!translate) return `${code}: ${message}`;
  const label = translate(`backend.${code}`);
  return `${label === `backend.${code}` ? code : label}: ${message}`;
}

// 右侧历史列表只需要分钟级时间，保持桌面端显示稳定。
export function formatTime(value, locale = "zh-CN") {
  return new Date(value).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
