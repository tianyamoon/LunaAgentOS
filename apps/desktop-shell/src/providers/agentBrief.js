export function buildAgentBriefPrompt() {
  return [
    "请用10个字以内给自己起一个普通用户一眼能看懂的职责标题。只返回标题，不要解释，不要标点。",
    "Give yourself a clear role title in 4 words or fewer. Return only the title. No punctuation.",
    "Return both titles in strict JSON only.",
    "Return strict JSON only: {\"zh-CN\":\"...\",\"en-US\":\"...\"}",
  ].join("\n");
}

export function sanitizeAgentBriefText(value, language) {
  const text = String(value || "")
    .replace(/^[`"“”'‘’\s]+|[`"“”'‘’\s]+$/g, "")
    .replace(/[。.!！?？,，;；:：]+$/g, "")
    .trim();
  if (!text) return "";
  // 职责简报是列表里的短标签，英文限制词数，中文限制字符数。
  if (language === "en-US") return text.split(/\s+/).slice(0, 4).join(" ");
  return Array.from(text).slice(0, 10).join("");
}

export function parseAgentBriefResponse(text, { translate = (key) => key } = {}) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error(translate("agentBrief.emptyResponse"));
  const jsonText = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
  const parsed = JSON.parse(jsonText);
  const zh = sanitizeAgentBriefText(parsed["zh-CN"] || parsed.zh || parsed.zhCN, "zh-CN");
  const en = sanitizeAgentBriefText(parsed["en-US"] || parsed.en || parsed.enUS, "en-US");
  if (!zh || !en) throw new Error(translate("agentBrief.invalidResponse"));
  return { "zh-CN": zh, "en-US": en };
}
