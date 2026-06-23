export const DEFAULT_ATTACHMENT_LIMITS = {
  maxFiles: 6,
  maxCharsPerFile: 120_000,
  // Anthropic 单图 base64 上限约 10MB；原始字节按此卡，留出 base64 ~33% 膨胀余量。
  maxImageBytes: 7_500_000,
};

// 仅这些图片类型可送进 ACP image block。排除 svg（可内嵌脚本）、bmp/tiff（多 runtime 不支持）。
const IMAGE_MIME_WHITELIST = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

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

// 判定是否为可接受的图片附件：mime 在白名单内，或扩展名在白名单内。
// 排除 svg 等可执行脚本类型。
export function isLikelyImageAttachment(fileLike = {}) {
  const type = String(fileLike.type || "").toLowerCase();
  if (IMAGE_MIME_WHITELIST.has(type)) return true;
  // 部分剪贴板图片 type 为空，回退到扩展名判定。
  if (type.startsWith("image/")) return IMAGE_MIME_WHITELIST.has(type);
  return IMAGE_EXTENSIONS.has(fileExtension(fileLike.name));
}

export function attachmentStatus(attachment) {
  if (attachment?.error) return "error";
  // 图片附件以 base64 是否就绪判定 ready（图片没有文本 content）。
  if (attachment?.kind === "image") return attachment.base64 ? "ready" : "metadata";
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
  // 图片走 ACP image block，绝不拼进 prompt 字符串；这里只处理文本附件。
  const ready = attachments.filter(
    (item) => item.kind !== "image" && attachmentStatus(item) === "ready",
  );
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

// 把就绪的图片附件收集为 ACP extra_blocks（旁路参数）。
// 每块 {type:"image", data:<裸 base64>, mimeType}，与后端 PromptBlock::Image 对应。
export function toPromptImageBlocks(attachments = []) {
  return attachments
    .filter((item) => item.kind === "image" && attachmentStatus(item) === "ready")
    .map((item) => ({
      type: "image",
      data: item.base64,
      mimeType: item.mime || item.type || "image/png",
    }));
}
