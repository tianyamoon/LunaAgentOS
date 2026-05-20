# LunaAgentOS Docs

这里集中放 LunaAgentOS 的产品边界、架构说明、运行时接入和验证记录。根目录 README 只保留项目入口级信息。

## 产品与阶段

- `prompt-v1-alignment.md`：Stage 1 产品边界与交接对齐说明
- `mvp-v1-interaction-model.md`：第一版交互模型与主 Agent 多会话机制
- `version-roadmap.md`：Stage / version 路线
- `mvp-v1-scope.md`：第一版最小需求路径

## 架构与原则

- `architecture-overview.md`：架构总览
- `tech-stack-decision.md`：技术选型决策
- `light-core-principles.md`：轻核心原则
- `why-lunaagentos.md`：项目动机
- `open-questions.md`：开放问题

## Runtime 与入口

- `hermes-acp-profile-runtime.md`：Hermes ACP 与 profile runtime 技术说明
- `hermes-tui-direction.md`：Hermes 过程可见与 TUI 化方向
- `target-matrix.md`：Claude / Hermes / Trae 样板矩阵
- `competitive-positioning.md`：竞品定位
- `../bridges/trae-ide/README.md`：Trae IDE Bridge 说明

## 代码入口

- `../desktop-shell/`：Stage 1 桌面壳工程
- `../prototype/console/`：早期控制台原型
- `../adapter.py`：早期 stdio adapter POC
- `../test_runner.py`：早期 adapter POC 验证入口

## 验证记录

- `validation-report.md`：早期 adapter POC 验证
- `desktop-shell-validation.md`：桌面壳验证记录
