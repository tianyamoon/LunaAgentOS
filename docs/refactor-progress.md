# LunaAgentOS Stage 1 重构进度（jitter / state / split）

对应总规划：`C:\Users\tiany\.windsurf\plans\lunaagentos-jitter-state-refactor-bacd67.md`

## 已落地的 commit

| Commit | Phase | 内容 |
|---|---|---|
| `7130c61` | A2 + A3 + A4 | stick-to-bottom controller + 单卡片增量渲染（流式抖动止血） |
| `16a6932` | B1 | session lifecycle 状态机 + 26 个单测 |
| `ee3e4ad` | B2 | main.js 接入状态机 + 合并 stopped/deleted 墓碑 Set |
| `04c187e` | C1 | i18n 拆出 `src/i18n/`（11 个单测） |
| `bcc15f5` | C2 + C3 | markdown / mermaid 拆出 `src/markdown/`（17+7 个单测） |
| `e69d813` | C5 | launch demo 纯数据函数拆出 `src/launchDemo/`（8 个单测） |
| `cc15fc0` | C7 (partial) | history 归档辅助函数拆出 `src/history/`（9 个单测） |
| _本轮_ | C9 + UX | sessions store 抽出 + main.js 接入 + 空 deck 占位文案智能切换（15 个单测） |

## main.js 体量变化

| 阶段 | 行数 |
|---|---|
| 起点 | 3474 |
| Phase A 后 | 3713 |
| Phase B 后 | 3852 |
| C1 (i18n) 后 | 3539 |
| C2+C3 (markdown) 后 | 3253 |
| C5 (demo) 后 | 3127 |
| C7-partial (history) 后 | 3068 |
| C9 + UX 后 | **2894** |

净减约 17% / 拆出 5 个独立模块 + 1 个状态机 + 1 个 UI 控制器 + 1 个 sessions store。

## 测试基线

`npm run test:all` 当前 **107 个测试全过**：

| 模块 | 测试 |
|---|---|
| `src/sessionIdentity.test.js` | 3 |
| `src/state/sessionLifecycle.test.js` | 26 |
| `src/state/sessionsStore.test.js` | 15 |
| `src/i18n/index.test.js` | 11 |
| `src/markdown/normalize.test.js` | 17 |
| `src/markdown/escape.test.js` | 7 |
| `src/launchDemo/index.test.js` | 8 |
| `src/history/entries.test.js` | 9 |
| `src/ui/stickToBottom.test.js` | 11 |

每个模块也有独立 `npm run test:<name>`：`identity / stick / lifecycle / store / i18n / markdown / demo / history`。

## 关键产物

### 抖动止血（Phase A）

- `desktop-shell/src/ui/stickToBottom.js`
  - per-element 控制器，区分用户 vs 程序滚动
  - registry 按 sessionId 维护、随 deck render 复用控制器
  - `notifyContentChanged()` 仅在 stuck 时跟随，用户上滑后绝不被拖回
- `desktop-shell/src/main.js`
  - `renderWorkspace` 改用控制器 sample / sync，删除"无条件 scrollTop = scrollHeight"
  - 流式事件改走 `scheduleSessionCardRender → renderSessionCardInPlace`，每帧 rAF 合批，单卡片就地更新（mermaid 也只对该卡片增量渲染）
  - 删除死的 `STREAM_RENDER_INTERVAL_MS` / `scrollSessionId` 选项
- `desktop-shell/src/styles.css` `.session-card-body`：`overflow-anchor: none + scrollbar-gutter: stable + overscroll-behavior: contain + contain: layout paint`

### 状态机（Phase B）

- `desktop-shell/src/state/sessionLifecycle.js`
  - 七态：`draft / live / restoring / archived / resume_failed / stopped / deleted`
  - 完整跳转矩阵 + `nextLifecycle` 抛 `InvalidLifecycleTransition`
  - `lifecycleFromLegacy` 桥接 `runtimeState + stoppedSessionIds + deletedSessionIds` 三套来源
- main.js helper：
  - `setSessionLifecycle(session, target)` 是 lifecycle **唯一写入入口**，自动同步 `runtimeState` 兼容字段、自动管理 stopped/deleted 墓碑
  - `markSessionDeletedTombstone(sessionId)` 处理"仅在历史里、不在 sessions 数组"的删除场景
  - `isSessionStoppedTombstone` / `isSessionDeletedTombstone` 是读侧门面，统一所有 `await` 后边界检查

### 模块化拆出

- `src/i18n/{translations.js, index.js}` — 字典 + `t()` + `setLanguage` + `applyDataI18n`
- `src/markdown/{normalize.js, escape.js, mermaid.js, index.js}` — markdown 渲染 + 规范化 + mermaid 懒加载
- `src/launchDemo/index.js` — 纯数据 builder（`buildLaunchDemoSessions / buildLaunchDemoHistoryEntries / createDemoTurn`）
- `src/history/entries.js` — `archivedSessionsFromHistory` + 历史 key 抽取（`normalizeSession` 入参注入）
- `src/state/sessionLifecycle.js` — 上面状态机
- `src/state/sessionsStore.js` — 工作台核心 mutable state（sessions / currentSessionId / activeSessionIds / 墓碑 Set / 三个 UI flag 容器），暴露 stable references + 显式 mutation API + subscribe / batch
- `src/ui/stickToBottom.js` — 上面控制器
- 已存在的 `src/sessionIdentity.js`（前序工作） — 保留并被新结构使用

## 还没做的（按计划顺序）

### Phase C 剩余

- **C4 providers**
  - 涉及 `providers / runtimeAvailability / runtimeInstances / hermesProfilesByInstance / runtimeTargets / targetsForProvider / etc.`
  - 跟 `currentTargetAgentId` 强耦合。C9 store 已就绪，下一步可以基于 store API 注入。
- **C6 runtime (ACP / fallback / streamEvents)**
  - `runFallbackSession / startAcpSession / appendStreamEventToTurn / updateTurnFromEvents / sessionSectionsFromEvents`
  - 仍然重度依赖 `sessions / activeSessionIds / 墓碑 Set / setSessionLifecycle / scheduleSessionCardRender`，但现在它们都已经在 `sessionsStore` 后面。
  - 拆分意义大；建议先做 C7 剩余作为热身。
- **C7 剩余**：`saveTurnToHistory / loadHistory` 留在 main.js（mutate `historyEntries / isHistoryLoading`，依赖 `invoke`）。
- **C8 + A1：UI 拆分 + lit-html 迁移**
  - 最大的一块。`renderWorkspace / renderSessionCard / renderTurn / renderHistory / renderProviders` 切到 `src/ui/` 多文件 + lit-html template。
  - 当前的 in-place 单卡片渲染已经基本根治抖动，所以 lit-html 不再急。

### Phase B 剩余

- **B3**：`flowDetailOpenState / collapsedTurnIds / sessionLatestOnlyState` 合并进 `session.uiFlags`。store 已经把它们收口为统一接口，B3 就是把 key 从 `${turnId}:${kind}` / `Set(turnId)` / `Map(sessionId)` 迁移到 session 对象内部 uiFlags 字段。

## 给下一个接手的 agent 的 4 句话提醒

1. **C9 store 已落地**：所有 sessions / currentSessionId / activeSessionIds / 墓碑 Set / 三个 UI flag 容器都在 `src/state/sessionsStore.js`。`main.js` 顶部通过 `getXxxRef()` 拿 stable references；mutation 入口走 `sessionsStore.upsertHead / removeSessionById / setCurrentSessionId / markActive` 等。**不要再加新的 module-level state**——加进 store。
2. 修改 lifecycle 时必须走 `setSessionLifecycle(session, target)`，不要直接写 `session.runtimeState =` 或裸 `stoppedSessionIds.add`。
3. 流式事件路径已经是 turn-level rAF 合批 + per-card render；不要改回整 deck `innerHTML =`。
4. `Stage 1` 边界没有变。`launchDemo` 仍随主包加载、Hermes 仍是同时存在的真实第二入口。

## 验收命令

```powershell
cd desktop-shell
npm run test:all      # 所有单测
npm run build         # vite production build
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri dev     # 实际跑工作台
```

抖动验收口径：

- 思考流 / 输出流持续涌入时 deck 整体不抖动
- 滚动条出现时不抖宽度
- 用户主动上滑后**绝不被拖回**
- 用户回到底部 24px 内自动重新跟随
- 多会话同时输出互不干扰
