export const stateNames = {
  0: "INIT",
  1: "IDLE",
  2: "THINK",
  3: "TOOLING",
  4: "RESP",
  5: "DONE",
  9: "ERROR",
};

export const agents = [
  {
    id: "claude",
    name: "Claude Code",
    role: "强大样板",
    note: "代表高价值、强能力的付费 Agent 目标。",
    task: "等待接入 Claude Code 真实运行时",
    state: 1,
  },
  {
    id: "hermes",
    name: "Hermes",
    role: "通用样板",
    note: "首个最适合推进真实 CLI Adapter 的现实目标。",
    task: "总结当前适配器验证结果，并决定下一步真实接入顺序。",
    state: 1,
  },
  {
    id: "trae",
    name: "Trae IDE",
    role: "免费样板",
    note: "产品上必须纳入，但工程上应走 Bridge 路线。",
    task: "规划 IDE Bridge 方案，不伪装成原生 CLI。",
    state: 1,
  },
];

export const sampleEvents = {
  hermes: [
    {
      type: "state",
      state: 0,
      payload: { content: "Hermes adapter 正在启动进程与会话。" },
    },
    {
      type: "thought",
      state: 2,
      payload: { content: "正在分析当前协议验证结果，并准备整理下一步接入顺序。" },
    },
    {
      type: "tool_request",
      state: 3,
      payload: {
        content: "调用本地验证结果与目标矩阵。",
        tool_name: "load_validation_report",
        tool_args: {
          file: "docs/validation-report.md",
          matrix: "docs/target-matrix.md",
        },
      },
    },
    {
      type: "response",
      state: 4,
      payload: {
        content: "当前 mock 协议链已验证通过。建议先接 Hermes，再推进 Claude Code，并单独研究 Trae IDE Bridge。",
      },
    },
    {
      type: "state",
      state: 5,
      payload: { content: "当前任务已完成，等待归档。" },
    },
  ],
  claude: [
    {
      type: "state",
      state: 0,
      payload: { content: "Claude Code 会话初始化中。" },
    },
    {
      type: "thought",
      state: 2,
      payload: { content: "高价值样板正在评估任务请求与上下文。" },
    },
    {
      type: "tool_request",
      state: 3,
      payload: {
        content: "分析代码与协议文档。",
        tool_name: "code_scan",
        tool_args: {
          scope: "adapter protocol",
          target: "LunaAgentOS",
        },
      },
    },
    {
      type: "response",
      state: 4,
      payload: {
        content: "Claude Code 样板适合作为第二个真实接入目标，用来证明 LunaAgentOS 的高端用户相关性。",
      },
    },
    {
      type: "state",
      state: 5,
      payload: { content: "Claude Code 样板输出完成。" },
    },
  ],
  trae: [
    {
      type: "state",
      state: 0,
      payload: { content: "Trae IDE Bridge 方案初始化。" },
    },
    {
      type: "thought",
      state: 2,
      payload: { content: "当前重点不是伪造 CLI 接入，而是评估 IDE-first 产品的桥接面。" },
    },
    {
      type: "tool_request",
      state: 3,
      payload: {
        content: "比较可行的 Bridge 方案。",
        tool_name: "bridge_research",
        tool_args: {
          candidates: ["桌面自动化", "IDE 插件桥", "终端桥接", "会话代理"],
        },
      },
    },
    {
      type: "response",
      state: 4,
      payload: {
        content: "Trae IDE 在产品上属于免费样板，但工程上应作为独立 Bridge 路线推进。",
      },
    },
    {
      type: "state",
      state: 5,
      payload: { content: "Trae IDE 样板分析完成。" },
    },
  ],
};
