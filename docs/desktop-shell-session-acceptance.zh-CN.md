# Desktop Shell 会话状态与历史验收清单

本文记录 Runtime Session Card、历史恢复、只读/失败发送策略、消息展开和多卡片布局的桌面端验收矩阵。

## 启动

```powershell
cd apps/desktop-shell
npm.cmd run dev
```

默认地址：`http://127.0.0.1:1420`。

## 自动可确认项

- Vite 首页返回 `200`。
- `src/main.js` 返回 `200`。
- `npm.cmd run test:all`、`npm.cmd run lint:undef`、`npm.cmd run lint:architecture`、`npm.cmd run build` 全部通过。
- 应用内浏览器可完成 DOM 与交互验收；普通浏览器预览通过 `desktopBridge` 使用只读空快照启动，不伪造桌面写操作。
- 1280x720 与 390x844 视口均无页面级横向溢出；窄屏顶栏工具会自然换行，workspace、composer、history 均保持在视口内。
- 中英文切换、主题切换、无 runtime 时发送阻断均已通过浏览器交互验证。

## 手动验收矩阵

### 可恢复历史

1. 从右侧历史打开带 `acpSessionId` 的历史记录。
2. 预期：卡片进入只读原文，右侧状态与卡片状态一致。
3. 再次点击右侧历史或卡片“恢复会话”。
4. 预期：进入 restore flow；恢复成功后 `access_mode=interactive`，composer 可发送，顶部状态、card badge、右侧 item、MessageList 状态一致。

### 不可恢复历史

1. 打开缺少 `acpSessionId` 的历史记录。
2. 预期：显示只读原文，notice 明确说明无法恢复原会话，只能另开。
3. 在 composer 直接发送。
4. 预期：发送被阻止，不静默新开；只有显式“另开会话”才创建新 session，并显示“已另开新会话”类 notice。

### 失败历史

1. 打开失败历史记录。
2. 预期：状态为 failed/read-only 或 resume_failed；不显示运行中动画。
3. 尝试直接发送。
4. 预期：不伪装续写原会话；可恢复时提示先恢复，不可恢复时提示另开。

### Failed Live Session

1. 制造一个 live runtime 失败会话。
2. 预期：失败 card 不重复生成；默认不可隐式发送。
3. 如果可恢复，composer 提示先恢复；如果不可恢复，提示另开会话。

### Completed Session

1. 完成一个会话。
2. 预期：顶部 workspace、card badge、右侧 history item、MessageList 全部显示完成/可继续语义。
3. 预期：MessageList 顶层顺序为 user、最终 assistant 主体、worked_for 摘要；工具/思考过程默认折叠在 worked_for 中。

### Running Session

1. 启动一个正在执行的 session。
2. 预期：当前 live turn 默认展示 thinking/tool/runtime rows。
3. 预期：只有当前 live turn/card badge 有 running 动画；只读历史和旧 running 快照不闪烁。

### 展开与虚拟列表高度

1. 展开“查看原文”、worked_for、debug JSON。
2. 预期：展开内容自然撑开；后续 row offset 下移，不覆盖下一行。
3. 收起后再展开。
4. 预期：高度缓存刷新，不保留旧 offset。

### 多卡片 Grid/Focused

1. 同时打开两个以上 session card。
2. grid 模式预期：card 宽度稳定，右侧历史可点，内部 message scroller 不撑破卡片。
3. focused 模式预期：只放大目标 card；底部 mini card 与主 card 状态同源；内部滚动和右侧历史互不污染。

## 本轮验收结论

- 纯逻辑、构建、Vite HTTP smoke 和应用内浏览器基础交互验收已完成。
- 普通浏览器预览启动不再依赖 `window.__TAURI__.core`，且不会把不可用的桌面写操作伪装为成功。
- 需要真实 ACP runtime 与可恢复历史数据的四条端到端路径，需在桌面环境手动完成。
