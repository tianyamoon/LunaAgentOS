//! Runtime Probe Module。
//! 集中执行运行环境探测，并把不同 Adapter 的结果归一化为稳定的前端视图数据。

use crate::adapter_extensions;
use crate::adapter_registry;
use crate::runtime_config::load_runtime_config_file;
use serde::Serialize;
use serde_json::Value;
use std::process::Command;
use tauri::AppHandle;

/// Windows 下隐藏短命探测进程窗口。
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Provider 级探测摘要。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeProviderProbe {
    pub(crate) provider_id: String,
    pub(crate) configured: bool,
    pub(crate) available: bool,
    pub(crate) command: String,
    pub(crate) summary: String,
    pub(crate) detail: String,
}

/// 一次完整探测的 Provider 与 Runtime Instance 集合。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeProbeResult {
    providers: Vec<RuntimeProviderProbe>,
    instances: Vec<RuntimeInstanceProbe>,
}

/// 单个运行环境实例的探测结果。
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeInstanceProbe {
    pub(crate) id: String,
    pub(crate) provider_id: String,
    pub(crate) runtime_label: String,
    pub(crate) command_kind: String,
    pub(crate) command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) transport: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) adapter_source_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) capabilities: Option<adapter_registry::AdapterCapabilities>,
    pub(crate) configured: bool,
    pub(crate) available: bool,
    pub(crate) summary: String,
    pub(crate) detail: String,
    pub(crate) version: Option<String>,
}

/// 创建不会在 Windows 上闪出控制台窗口的子进程。
fn build_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// 执行借用参数的探测命令。
pub(crate) fn run_shell(shell: &str, args: &[&str]) -> Result<String, String> {
    let output = build_command(shell)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else if !stderr.is_empty() {
        Err(stderr)
    } else {
        Err(stdout)
    }
}

/// 执行拥有所有权参数的探测命令，供 Manifest healthCheck 使用。
fn run_shell_owned(shell: &str, args: &[String]) -> Result<String, String> {
    let output = build_command(shell)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if output.status.success() {
        Ok(stdout)
    } else if !stderr.is_empty() {
        Err(stderr)
    } else {
        Err(stdout)
    }
}

/// 判断可选字符串配置是否包含有效内容。
pub(crate) fn is_configured(value: &Option<String>) -> bool {
    value.as_ref().is_some_and(|item| !item.trim().is_empty())
}

/// 使用命令输出中的第一条非空行作为版本摘要。
fn first_output_line(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

/// 把一条探测命令的结果归一化为 Runtime Instance。
pub(crate) fn runtime_instance_probe(
    id: &str,
    provider_id: &str,
    runtime_label: &str,
    command_kind: &str,
    command: &str,
    configured: bool,
    result: Result<String, String>,
) -> RuntimeInstanceProbe {
    let (available, detail) = match result {
        Ok(output) => (true, output),
        Err(error) => (false, error),
    };
    let summary = if available {
        "available"
    } else if configured {
        "unavailable"
    } else {
        "not_configured"
    };
    let version = available.then(|| first_output_line(&detail)).flatten();
    RuntimeInstanceProbe {
        id: id.to_string(),
        provider_id: provider_id.to_string(),
        runtime_label: runtime_label.to_string(),
        command_kind: command_kind.to_string(),
        command: command.to_string(),
        transport: None,
        adapter_source_path: None,
        capabilities: None,
        configured,
        available,
        summary: summary.to_string(),
        detail,
        version,
    }
}

/// 根据 Runtime Instance 集合计算 Provider 级摘要。
pub(crate) fn provider_probe_from_instances(
    provider_id: &str,
    configured: bool,
    command: &str,
    instances: &[RuntimeInstanceProbe],
) -> RuntimeProviderProbe {
    let available_count = instances.iter().filter(|item| item.available).count();
    let available = available_count > 0;
    let summary = if available {
        "available"
    } else if configured {
        "unavailable"
    } else {
        "not_configured"
    };
    let detail = if instances.is_empty() {
        "未检测到运行环境。".to_string()
    } else {
        format!("{} / {} runtime 可用。", available_count, instances.len())
    };
    RuntimeProviderProbe {
        provider_id: provider_id.to_string(),
        configured,
        available,
        command: command.to_string(),
        summary: summary.to_string(),
        detail,
    }
}

/// 为没有专用 Extension 的 Manifest Adapter 执行通用探测。
pub(crate) fn adapter_instance_probe(
    adapter: &adapter_registry::AdapterDefinition,
) -> RuntimeInstanceProbe {
    let result = adapter.health_check.as_ref().map(|health| {
        adapter_registry::allow_process_exec(adapter, &health.command, &health.args)
            .and_then(|_| run_shell_owned(&health.command, &health.args))
    });
    let available = result.as_ref().map(|item| item.is_ok()).unwrap_or(true);
    let detail = match result {
        Some(Ok(output)) => output,
        Some(Err(error)) => error,
        None => "Manifest loaded; no healthCheck configured.".to_string(),
    };
    let summary = if available { "available" } else { "unavailable" };
    let version = available.then(|| first_output_line(&detail)).flatten();
    RuntimeInstanceProbe {
        id: format!("{}-manifest", adapter.id),
        provider_id: adapter.id.clone(),
        runtime_label: "Manifest".to_string(),
        command_kind: "manifest".to_string(),
        command: format!("{} {}", adapter.command, adapter.args.join(" "))
            .trim()
            .to_string(),
        transport: Some(adapter.transport.clone()),
        adapter_source_path: Some(adapter.source_path.clone()),
        capabilities: Some(adapter.capabilities.clone()),
        configured: true,
        available,
        summary: summary.to_string(),
        detail,
        version,
    }
}

/// 从通用 Manifest 探测结果生成 Provider 摘要。
pub(crate) fn adapter_provider_probe(
    adapter: &adapter_registry::AdapterDefinition,
    instance: &RuntimeInstanceProbe,
) -> RuntimeProviderProbe {
    RuntimeProviderProbe {
        provider_id: adapter.id.clone(),
        configured: true,
        available: instance.available,
        command: adapter.name.clone(),
        summary: instance.summary.clone(),
        detail: instance.detail.clone(),
    }
}

/// 探测指定 Adapter。
#[tauri::command]
pub(crate) fn runtime_adapter_probe(
    app: AppHandle,
    adapter_id: String,
) -> Result<RuntimeProviderProbe, String> {
    let config = load_runtime_config_file(&app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)?;
    if adapter.identity_only {
        return Err(format!("adapter {adapter_id} is identity-only and cannot be probed"));
    }
    Ok(adapter_extensions::probe_adapter(&adapter, &config).provider)
}

/// 探测全部可运行 Adapter，identity-only Adapter 只展示身份，不参与探测。
fn runtime_probe_blocking(app: &AppHandle) -> RuntimeProbeResult {
    let config = load_runtime_config_file(app);
    let mut providers = Vec::new();
    let mut instances = Vec::new();
    let adapter_result = adapter_registry::load_adapters(&config.adapter_plugin_paths);
    for adapter in adapter_result.adapters {
        if adapter.identity_only {
            continue;
        }
        let probe = adapter_extensions::probe_adapter(&adapter, &config);
        providers.push(probe.provider);
        instances.extend(probe.instances);
    }
    RuntimeProbeResult {
        providers,
        instances,
    }
}

#[tauri::command]
pub(crate) async fn runtime_probe(app: AppHandle) -> Result<RuntimeProbeResult, String> {
    tauri::async_runtime::spawn_blocking(move || runtime_probe_blocking(&app))
        .await
        .map_err(|error| error.to_string())
}

fn runtime_adapter_targets_blocking(
    app: &AppHandle,
    adapter_id: &str,
    runtime_instance_id: Option<&str>,
) -> Result<Vec<Value>, String> {
    let config = load_runtime_config_file(app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)?;
    adapter_extensions::adapter_targets(&adapter, &config, runtime_instance_id)
        .unwrap_or_else(|| Ok(Vec::new()))
}

#[tauri::command]
pub(crate) async fn runtime_adapter_targets(
    app: AppHandle,
    adapter_id: String,
    runtime_instance_id: Option<String>,
) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        runtime_adapter_targets_blocking(&app, &adapter_id, runtime_instance_id.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn runtime_adapter_slash_commands_blocking(
    app: &AppHandle,
    adapter_id: &str,
    runtime_instance_id: Option<&str>,
) -> Result<Vec<adapter_registry::SlashCommandCapability>, String> {
    let config = load_runtime_config_file(app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)?;
    adapter_extensions::slash_commands(&adapter, &config, runtime_instance_id)
        .unwrap_or_else(|| Ok(Vec::new()))
}

#[tauri::command]
pub(crate) async fn runtime_adapter_slash_commands(
    app: AppHandle,
    adapter_id: String,
    runtime_instance_id: Option<String>,
) -> Result<Vec<adapter_registry::SlashCommandCapability>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        runtime_adapter_slash_commands_blocking(&app, &adapter_id, runtime_instance_id.as_deref())
    })
    .await
    .map_err(|error| error.to_string())?
}
