# 架构静态检查保护模块边界

LunaAgentOS 使用 `apps/desktop-shell/scripts/check-architecture.mjs` 对容易回退的架构边界进行静态检查。该脚本不是通用 linter，而是领域架构护栏：它只检查已经形成共识、且适合机械验证的规则。

## Context

桌面 Shell 曾同时承担 Adapter 特例、History invoke、View mutation 和 Runtime Session Card 实现。单靠代码评审容易让临时实现重新进入 `main.js` 或绕过已经建立的深 Module。

## Decision

- `main.js` 使用渐进式行数上限，先阻止继续膨胀，再随拆分进度逐步下调阈值。
- Shell 通用入口禁止出现具体 Adapter 的运行规则。
- History 后端 invoke 必须经过 `historyRepository`。
- View 不得直接修改 Store 内部对象。
- Rust `lib.rs` 不得恢复废弃的专用 Adapter ACP command。

## Consequences

- 新增领域能力时，需要先找到合适的 Module Interface。
- 静态检查只覆盖可机械判断的底线，不能替代设计评审。
- 当前行数阈值是阶段性约束，不代表 `main.js` 已完成最终收缩。
