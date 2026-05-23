// Markdown normalization helpers.
//
// Pure string transforms that prepare runtime / streaming markdown for the
// rendering pipeline. They never touch the DOM and have no dependencies,
// so they are safe to test in Node and reuse outside the browser.
//
// The runtime payload tends to glue header + table + bullets together
// without breaks. Backend chunked streaming may also leave odd unclosed
// fences / inline tokens. This module fixes both.

export function transformOutsideCodeFences(text, transformLine) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const output = [];
  let inFence = false;
  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      return;
    }
    output.push(inFence ? line : transformLine(line));
  });
  return output.join("\n");
}

export function splitCollapsedMarkdownTableRows(line) {
  return String(line || "")
    .replace(/\|\s*(?=\|\s*:?-{3,}:?\s*\|)/g, "|\n")
    .replace(/\|\s*(?=\|[^|\n]{1,80}\|[^|\n]{0,120}\|[^|\n]{0,120}\|)/g, "|\n");
}

export function normalizeRuntimeMarkdown(text) {
  return transformOutsideCodeFences(text, (line) => {
    let value = splitCollapsedMarkdownTableRows(line)
      .replace(/(\|)\s*(?=\*\*[^*\n]{1,80}\*\*[^|\n]*(?:#{1,6}\s|$))/gu, "$1\n\n")
      .replace(/([^\n#])(?=#{1,6}\s+\S)/g, "$1\n\n")
      .replace(/(#{1,6}\s*[^\n|]{1,180}?)\s*(\|)/g, "$1\n$2")
      .replace(/(^|\n)(#{1,6}\s+\d+(?:\.\d+)?\s+[^-\n]{2,50})\s*-\s*/gu, "$1$2\n\n- ")
      .replace(/([^\n])-\s*(?=\s*\*\*[^*\n]{1,40}\*\*)/gu, "$1\n- ")
      .replace(/(^|\n)-(?=\*\*)/gu, "$1- ")
      .replace(/(^|\n)---(?=\*\*)/gu, "$1---\n\n");
    if (!value.trimStart().startsWith("|") && (value.match(/\|/g) || []).length >= 2) {
      value = value.replace(/^(.{1,180}?)(\|[^|\n]+\|[^|\n]*\|.*)$/, (_, prefix, table) => `${prefix.trimEnd()}\n${table}`);
    }
    return value;
  });
}

export function markdownTableCellCount(line) {
  const value = String(line || "").trim().replace(/^\|/, "").replace(/\|$/, "");
  return value ? value.split("|").length : 0;
}

export function isMarkdownTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(String(line || "").trim());
}

export function hasMarkdownTable(text) {
  const lines = String(text || "").split(/\r?\n/);
  return lines.some((line, index) => line.includes("|")
    && isMarkdownTableSeparator(lines[index + 1]));
}

export function closeStreamingMarkdown(text) {
  let value = String(text || "");
  const fenceCount = (value.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) value += "\n```";
  const inlineTickCount = (value.match(/(?<!`)`(?!`)/g) || []).length;
  if (inlineTickCount % 2 === 1) value += "`";
  const strongCount = (value.match(/\*\*/g) || []).length;
  if (strongCount % 2 === 1) value += "**";
  const strikeCount = (value.match(/~~/g) || []).length;
  if (strikeCount % 2 === 1) value += "~~";
  return value;
}

export function normalizeLooseMarkdownTables(text) {
  const lines = String(text || "").split(/\r?\n/);
  const output = [];
  let index = 0;
  let inFence = false;
  let inExistingTable = false;

  while (index < lines.length) {
    const current = lines[index];
    if (current.trim().startsWith("```")) {
      inFence = !inFence;
      inExistingTable = false;
      output.push(current);
      index += 1;
      continue;
    }
    if (inFence) {
      output.push(current);
      index += 1;
      continue;
    }
    if (!current.trim() || !current.includes("|")) {
      inExistingTable = false;
    }
    if (inExistingTable && current.includes("|") && current.trim()) {
      output.push(current);
      index += 1;
      continue;
    }
    if (isMarkdownTableSeparator(current)) {
      output.push(current);
      inExistingTable = true;
      index += 1;
      continue;
    }
    const next = lines[index + 1];
    const looksLikeTableHeader = current?.includes("|")
      && next?.includes("|")
      && !isMarkdownTableSeparator(next);

    if (!looksLikeTableHeader) {
      output.push(current);
      index += 1;
      continue;
    }

    const tableLines = [];
    while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
      tableLines.push(lines[index]);
      index += 1;
    }

    if (tableLines.length < 2) {
      output.push(...tableLines);
      continue;
    }

    const columnCount = Math.max(...tableLines.map(markdownTableCellCount));
    if (columnCount < 2) {
      output.push(...tableLines);
      continue;
    }

    output.push(tableLines[0]);
    output.push(Array.from({ length: columnCount }, () => "---").join("|"));
    output.push(...tableLines.slice(1));
  }

  return output.join("\n");
}
