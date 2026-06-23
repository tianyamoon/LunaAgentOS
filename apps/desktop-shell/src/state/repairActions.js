// 修复动作注册表：把后端给出的 repair_hint 代码翻译成可点击的修复动作。
// 本期范围严格限制为「复制命令 + 跳转 + 重新探测」，不触后端、不执行任何进程。
// 因此 copy_command 只使用静态命令模板，绝不把探测到的路径等可控字符串插值进去。

export const REPAIR_ACTION_TYPE = Object.freeze({
  copy_command: "copy_command",
  open_dialog: "open_dialog",
  reprobe: "reprobe",
});

// 仅内建、命令形态已知的 provider 才提供可复制命令。
// 未知/动态 adapter 不在此表中，会自动退化为「只跳转 + 重新探测」。
const COMMAND_TEMPLATES = Object.freeze({
  claude: Object.freeze({
    login: "claude auth login",
    status: "claude auth status",
    update: "claude update",
  }),
});

// 探测器对 WSL 实例使用 wsl.exe 包裹；对用户而言，最简交互形式是直接前缀 wsl。
// 其余 commandKind（native / bridge / remote / ide / manifest）不加前缀：
// native 直接在本机执行；bridge/remote 无法安全合成命令，则不产出 copy_command。
function hostPrefix(instance = {}) {
  const kind = String(instance.commandKind || "").toLowerCase();
  return kind === "wsl" ? "wsl " : "";
}

// 解析某个 provider 在指定动作下的可复制命令；无模板时返回 null（调用方将其过滤掉）。
function resolveCommand(providerId, verb, instance) {
  const base = COMMAND_TEMPLATES[providerId]?.[verb];
  if (!base) return null;
  return `${hostPrefix(instance)}${base}`.trim();
}

function copyCommand(labelKey, providerId, verb, instance) {
  const command = resolveCommand(providerId, verb, instance);
  if (!command) return null;
  return { type: REPAIR_ACTION_TYPE.copy_command, labelKey, command };
}

function openProviderDialog(providerId) {
  return { type: REPAIR_ACTION_TYPE.open_dialog, labelKey: "availability.repairAction.openConnection", dialog: "provider", providerId };
}

function reprobe(providerId) {
  return { type: REPAIR_ACTION_TYPE.reprobe, labelKey: "availability.repairAction.reprobe", providerId };
}

// 每个 repair_hint 代码 → 有序动作构造器。构造器接收 context，惰性解析命令变体。
const REPAIR_PLANS = Object.freeze({
  run_agent_login: ({ providerId, instance }) => [
    copyCommand("availability.repairAction.copyLogin", providerId, "login", instance),
    reprobe(providerId),
  ],
  check_runtime_login: ({ providerId, instance }) => [
    copyCommand("availability.repairAction.copyStatus", providerId, "status", instance),
    reprobe(providerId),
  ],
  update_runtime: ({ providerId, instance }) => [
    copyCommand("availability.repairAction.copyUpdate", providerId, "update", instance),
    reprobe(providerId),
  ],
  check_runtime_command: ({ providerId }) => [openProviderDialog(providerId), reprobe(providerId)],
  configure_provider: ({ providerId }) => [openProviderDialog(providerId)],
  configure_profile: ({ providerId }) => [openProviderDialog(providerId)],
  check_agent_configuration: ({ providerId }) => [openProviderDialog(providerId), reprobe(providerId)],
  // send_to_connect 已由「选中并发送」交互覆盖，这里只保留被动文案，不产出动作。
  send_to_connect: () => [],
});

// 根据健康对象与上下文构造修复动作列表。
// health.repair_hint 缺失或未登记时返回空数组；无法解析命令的 copy_command 会被过滤。
export function buildRepairActions(health = {}, context = {}) {
  const code = health?.repair_hint;
  if (!code || typeof code !== "string") return [];
  const plan = REPAIR_PLANS[code];
  if (!plan) return [];
  const ctx = {
    providerId: context.providerId || "",
    instance: context.instance || {},
    target: context.target || null,
  };
  return plan(ctx).filter(Boolean);
}
