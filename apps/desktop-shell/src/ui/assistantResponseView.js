export function splitAssistantResponseForDisplay(text, phase = "final") {
  const value = String(text || "");
  if (phase === "streaming") return { prelude: "", body: value };
  const match = value.match(/#{1,6}\s*Part\s*\d+[^\n]{0,80}/i);
  if (!match || match.index == null || match.index < 120) return { prelude: "", body: value };
  const prelude = value.slice(0, match.index).replace(/[-\s]+$/g, "").trim();
  const body = value.slice(match.index).trim();
  const looksLikeProcess = /我|需要|确认|检查|获取|查询|开始|写|todo|Now|Let me|I need/i.test(prelude);
  if (!prelude || !body || !looksLikeProcess) return { prelude: "", body: value };
  return { prelude, body };
}

function renderResponsePrelude(prelude, { escapeHtml, t }) {
  if (!prelude) return "";
  return `
    <details class="response-prelude-detail">
      <summary>${t("report.prelude")}</summary>
      <div class="terminal-pre">${escapeHtml(prelude)}</div>
    </details>
  `;
}

export function renderAssistantResponse(text, phase = "final", {
  closeStreamingMarkdown,
  escapeHtml,
  renderRichText,
  t,
}) {
  const source = phase === "streaming" ? closeStreamingMarkdown(text) : text;
  const display = splitAssistantResponseForDisplay(source, phase);
  return `
    <div class="runtime-output-view ${phase === "streaming" ? "is-streaming" : "is-final"}">
      ${renderResponsePrelude(display.prelude, { escapeHtml, t })}
      <div class="rich-text">${renderRichText(display.body)}</div>
      <details class="response-source-detail">
        <summary>${t("report.rawView")}</summary>
        <pre>${escapeHtml(display.body)}</pre>
      </details>
    </div>
  `;
}
