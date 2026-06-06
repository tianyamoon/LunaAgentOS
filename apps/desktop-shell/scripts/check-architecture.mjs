import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

// 架构检查只约束稳定边界，不尝试替代领域测试。
const root = resolve(import.meta.dirname, "..");
const repoRoot = resolve(root, "..", "..");
const failures = [];

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function fail(message) {
  failures.push(message);
}

function walk(relativeDir) {
  const absoluteDir = resolve(root, relativeDir);
  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry.name);
    const child = relative(root, absolutePath).replaceAll("\\", "/");
    return entry.isDirectory() ? walk(child) : [child];
  });
}

// main.js 只允许继续收缩；阈值按当前阶段设置，后续拆分时应继续降低。
const mainSource = read("src/main.js");
const mainLines = mainSource.split(/\r?\n/).length;
if (mainLines > 1700) fail(`src/main.js 行数回升到 ${mainLines}，超过阶段阈值 1700`);

// 工作区状态条和空态文案必须留在 View seam 后，不能回到 main.js 里拼 DOM。
if (/workspaceStatus\.(?:innerHTML|textContent)|workspaceEmpty\.querySelector|projectWorkspace(?:Status|EmptyCopy)/.test(mainSource)) {
  fail("src/main.js 重新包含工作区状态/空态 DOM 实现，应放在 workspaceStatusView 或 workspaceEmptyView");
}

// Shell 编排层不得重新认识具体 Adapter 名称。
if (/\b(?:hermes|claude|trae)\b/i.test(mainSource)) {
  fail("src/main.js 出现具体 Adapter 名称，应改为 manifest、Provider 元数据或 Adapter seam");
}

// Turn 过程必须保持有序 Timeline；旧的按事件类型分区视图不得复活。
for (const path of [
  "src/ui/turnEvents.js",
  "src/ui/turnEventsView.js",
  "src/ui/runtimeSessionTranscriptProjection.js",
  "src/ui/runtimeSessionTranscriptView.js",
  "src/ui/turnTimelineView.js",
]) {
  if (existsSync(resolve(root, path))) fail(`${path} 是废弃的固定过程分区视图，应使用 Runtime MessageList`);
}
if (/turnEventsFromTurn|renderTurnEventsHtml|renderTurnEventItemHtml/.test(mainSource)) {
  fail("src/main.js 重新引入固定过程分区渲染，应使用 Runtime MessageList");
}

// 用户侧只显示连续 MessageList；Turn 继续作为内部语义，不得恢复可见轮次套娃。
const stylesSource = read("src/styles.css");
if (/\.turn-block\b|\.session-latest-anchor\b/.test(stylesSource)) {
  fail("src/styles.css 重新引入旧版可见轮次容器，应使用 Runtime MessageList");
}

// History 磁盘调用必须集中经过前端 Repository。
const historyInvokePattern = /invoke\(\s*["'](?:history_|load_history|append_history|archive_history|delete_history|compact_history)/;
for (const path of walk("src")) {
  if (extname(path) !== ".js" || path.endsWith(".test.js") || path === "src/history/historyRepository.js") continue;
  if (historyInvokePattern.test(read(path))) fail(`${path} 绕过 History Repository 直接调用后端`);
}

// View 只能发命令，不能直接改写 Store 暴露对象。
const directViewMutationPattern = /\.(?:inWorkspace|record_state|access_mode|runtime_binding|lifecycle)\s*=(?!=)/;
for (const path of [...walk("src/ui"), ...walk("src/components")]) {
  if (extname(path) !== ".js" || path.endsWith(".test.js")) continue;
  if (directViewMutationPattern.test(read(path))) fail(`${path} 直接修改 Session 字段，应通过 Store 或 Controller`);
}

// Rust composition root 不得重新注册专用 Adapter command。
const rustLib = readFileSync(resolve(repoRoot, "apps/desktop-shell/src-tauri/src/lib.rs"), "utf8");
if (/runtime_acp_(?:claude|hermes)|runtime_hermes_profiles/.test(rustLib)) {
  fail("src-tauri/src/lib.rs 出现废弃的专用 Adapter command");
}

// 流式路径静态护栏：Card 外壳不得被 replaceWith 替换。
const cardControllerSource = read("src/ui/runtimeSessionCardController.js");
if (/\.replaceWith\(/.test(cardControllerSource)) {
  fail("runtimeSessionCardController.js 流式路径调用了 Card replaceWith，应使用 patchSessionCardFromViewModel");
}

// MessageList 对账不得无条件 append 已有节点。
const messageListViewSource = read("src/ui/runtimeSessionMessageListView.js");
if (/contentElement\.append\(node\)/.test(messageListViewSource) && !/insertBefore/.test(messageListViewSource)) {
  fail("runtimeSessionMessageListView.js 对账无条件 append，应使用游标顺序检查");
}

// History 列表渲染不得参与 Card transcript 渲染路径。
if (/renderHistory\(\).*renderSessionCard|renderSessionCard.*renderHistory\(\)/.test(mainSource)) {
  fail("src/main.js History 列表渲染与 Card transcript 渲染耦合，应分离刷新频率");
}

if (failures.length) {
  console.error("Architecture check failed:");
  failures.forEach((message) => console.error(`- ${message}`));
  process.exit(1);
}

console.log(`OK: architecture boundaries hold (main.js ${mainLines} lines)`);
