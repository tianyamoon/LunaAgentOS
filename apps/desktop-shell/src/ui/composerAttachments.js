export const DEFAULT_ATTACHMENT_LIMITS = {
  maxFiles: 6,
  maxCharsPerFile: 120_000,
};

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "py",
  "rs",
  "go",
  "java",
  "kt",
  "swift",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "cs",
  "php",
  "rb",
  "sh",
  "bash",
  "zsh",
  "ps1",
  "sql",
  "csv",
  "tsv",
  "log",
  "ini",
  "env",
  "gitignore",
]);

export function formatAttachmentBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileExtension(name = "") {
  const normalized = String(name).trim().toLowerCase();
  const index = normalized.lastIndexOf(".");
  if (index < 0) return normalized;
  return normalized.slice(index + 1);
}

export function isLikelyTextAttachment(fileLike = {}) {
  const type = String(fileLike.type || "").toLowerCase();
  if (type.startsWith("text/")) return true;
  if (type.includes("json") || type.includes("xml") || type.includes("yaml")) return true;
  return TEXT_EXTENSIONS.has(fileExtension(fileLike.name));
}

export function attachmentStatus(attachment) {
  if (attachment?.error) return "error";
  if (!attachment?.content) return "metadata";
  return "ready";
}

export function composerStats(text = "") {
  const value = String(text);
  return {
    chars: value.length,
    lines: value ? value.split(/\r\n|\r|\n/).length : 0,
  };
}

export function buildPromptWithAttachments(prompt, attachments = [], labels = {}) {
  const base = String(prompt || "").trim();
  const ready = attachments.filter((item) => attachmentStatus(item) === "ready");
  if (!ready.length) return base;
  const title = labels.title || "Attached context";
  const truncated = labels.truncated || "truncated";
  const blocks = ready.map((item) => {
    const size = item.sizeLabel || formatAttachmentBytes(item.size);
    const header = [item.name, item.type, size].filter(Boolean).join(" · ");
    const suffix = item.truncated ? `\n[${truncated}]` : "";
    return `### ${header}\n\n${item.content}${suffix}`;
  });
  return `${base}\n\n---\n${title}\n\n${blocks.join("\n\n---\n\n")}`;
}
