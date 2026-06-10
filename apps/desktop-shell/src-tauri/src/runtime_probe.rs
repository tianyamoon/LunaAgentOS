//! Runtime Probe Module。
//! 集中执行运行环境探测，并把不同 Adapter 的结果归一化为稳定的前端视图数据。

use crate::adapter_extensions;
use crate::adapter_registry;
use crate::runtime_config::load_runtime_config_file;
use crate::adapter_host::adapter_launch_spec_with_context;
use chrono::Utc;
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
    pub(crate) health: RuntimeHealth,
    pub(crate) health_evidence: Vec<HealthEvidence>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) model_control: Option<adapter_registry::AdapterModelControl>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) model_control: Option<adapter_registry::AdapterModelControl>,
    pub(crate) configured: bool,
    pub(crate) available: bool,
    pub(crate) verification_status: String,
    pub(crate) summary: String,
    pub(crate) detail: String,
    pub(crate) version: Option<String>,
    pub(crate) health: RuntimeHealth,
    pub(crate) health_evidence: Vec<HealthEvidence>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeHealth {
    pub(crate) installed: String,
    pub(crate) logged_in: String,
    pub(crate) cli_callable: String,
    pub(crate) profile_configured: String,
    pub(crate) wsl_or_bridge_available: String,
    pub(crate) model_or_key_configured: String,
    pub(crate) version_status: String,
    pub(crate) unavailable_reason: Option<String>,
    pub(crate) repair_hint: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HealthEvidence {
    pub(crate) field: String,
    pub(crate) source: String,
    pub(crate) detail: String,
    pub(crate) checked_at: String,
}

pub(crate) fn health_evidence(field: &str, source: &str, detail: String) -> HealthEvidence {
    HealthEvidence {
        field: field.into(),
        source: source.into(),
        detail,
        checked_at: Utc::now().to_rfc3339(),
    }
}

fn unknown_health() -> RuntimeHealth {
    RuntimeHealth {
        installed: "unknown".into(), logged_in: "unknown".into(), cli_callable: "unknown".into(),
        profile_configured: "unknown".into(), wsl_or_bridge_available: "unknown".into(),
        model_or_key_configured: "unknown".into(), version_status: "unknown".into(),
        unavailable_reason: None, repair_hint: None,
    }
}

fn safe_detail(value: &str) -> String {
    let secret_markers = ["api_key", "apikey", "token", "secret", "authorization", "bearer "];
    value.lines().map(|line| {
        let lower = line.to_ascii_lowercase();
        if secret_markers.iter().any(|marker| lower.contains(marker)) { "[redacted]".to_string() } else { line.to_string() }
    }).collect::<Vec<_>>().join("\n")
}

pub(crate) fn redact_diagnostic_detail(value: &str) -> String { safe_detail(value) }

fn numeric_version(value: &str) -> Vec<u64> {
    value.split(|ch: char| !ch.is_ascii_digit()).filter(|part| !part.is_empty())
        .take(3).filter_map(|part| part.parse().ok()).collect()
}

pub(crate) fn version_status(version: Option<&str>, minimum: Option<&str>) -> String {
    let (Some(version), Some(minimum)) = (version, minimum) else { return if version.is_some() { "unknown".into() } else { "unknown".into() }; };
    if numeric_version(version) < numeric_version(minimum) { "outdated".into() } else { "ok".into() }
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
        Ok(output) => (true, safe_detail(&output)),
        Err(error) => (false, safe_detail(&error)),
    };
    let summary = if available {
        "available"
    } else if configured {
        "unavailable"
    } else {
        "not_configured"
    };
    let version = available.then(|| first_output_line(&detail)).flatten();
    let mut health = unknown_health();
    health.installed = if available { "ok" } else if detail.to_ascii_lowercase().contains("not found") || detail.to_ascii_lowercase().contains("not recognized") { "missing" } else { "unknown" }.into();
    health.cli_callable = if available { "ok" } else { "failed" }.into();
    if ["wsl", "bridge", "remote", "ide"].contains(&command_kind) {
        health.wsl_or_bridge_available = if available { "ok" } else { "failed" }.into();
    }
    if !available { health.unavailable_reason = Some("cli_not_callable".into()); health.repair_hint = Some("check_runtime_command".into()); }
    let health_evidence = vec![health_evidence("cli_callable", "runtime_command", detail.clone())];
    RuntimeInstanceProbe {
        id: id.to_string(),
        provider_id: provider_id.to_string(),
        runtime_label: runtime_label.to_string(),
        command_kind: command_kind.to_string(),
        command: command.to_string(),
        transport: None,
        adapter_source_path: None,
        capabilities: None,
        model_control: None,
        configured,
        available,
        verification_status: if available { "verified_available" } else { "verified_unavailable" }.into(),
        summary: summary.to_string(),
        detail,
        version,
        health,
        health_evidence,
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
    let verified_available_count = instances
        .iter()
        .filter(|item| item.verification_status == "verified_available")
        .count();
    let available = available_count > 0;
    let summary = if verified_available_count > 0 {
        "available"
    } else if available {
        "unknown"
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
    let representative = instances.iter().find(|item| item.available).or_else(|| instances.first());
    RuntimeProviderProbe {
        provider_id: provider_id.to_string(),
        configured,
        available,
        command: command.to_string(),
        summary: summary.to_string(),
        detail,
        health: representative.map(|item| item.health.clone()).unwrap_or_else(unknown_health),
        health_evidence: representative.map(|item| item.health_evidence.clone()).unwrap_or_default(),
        model_control: representative.and_then(|item| item.model_control.clone()),
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
    let verification_status = match &result {
        Some(Ok(_)) => "verified_available",
        Some(Err(_)) => "verified_unavailable",
        None => "unknown",
    };
    let detail = match result {
        Some(Ok(output)) => safe_detail(&output),
        Some(Err(error)) => safe_detail(&error),
        None => "Manifest loaded; no healthCheck configured.".to_string(),
    };
    let summary = match verification_status {
        "verified_available" => "available",
        "verified_unavailable" => "unavailable",
        _ => "unknown",
    };
    let version = (verification_status == "verified_available")
        .then(|| first_output_line(&detail))
        .flatten();
    let mut health = unknown_health();
    if verification_status == "verified_available" {
        health.installed = "ok".into();
        health.cli_callable = "ok".into();
    } else if verification_status == "verified_unavailable" {
        health.cli_callable = "failed".into();
    }
    health.version_status = version_status(version.as_deref(), adapter.version_policy.as_ref().and_then(|policy| policy.minimum_version.as_deref()));
    if verification_status == "verified_unavailable" {
        health.unavailable_reason = Some("cli_not_callable".into());
        health.repair_hint = Some("check_runtime_command".into());
    }
    let configured_keys: Vec<_> = adapter.env.keys().filter(|key| {
        let key = key.to_ascii_uppercase(); key.contains("KEY") || key.contains("TOKEN") || key.contains("SECRET")
    }).collect();
    let evidence_source = if adapter.health_check.is_some() {
        "manifest_health_check"
    } else {
        "manifest_loaded"
    };
    let mut evidence = vec![health_evidence("cli_callable", evidence_source, detail.clone())];
    if !configured_keys.is_empty() {
        evidence.push(health_evidence(
            "model_or_key_configured",
            "manifest_env_presence",
            "credential-like configuration is present; validity was not verified".into(),
        ));
    }
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
        model_control: adapter.model_control.clone(),
        configured: true,
        available,
        verification_status: verification_status.into(),
        summary: summary.to_string(),
        detail,
        version,
        health,
        health_evidence: evidence,
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
        health: instance.health.clone(),
        health_evidence: instance.health_evidence.clone(),
        model_control: adapter.model_control.clone(),
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

#[tauri::command]
pub(crate) async fn runtime_adapter_model_control(
    app: AppHandle,
    adapter_id: String,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
    cwd: Option<String>,
) -> Result<Value, String> {
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    tauri::async_runtime::spawn_blocking(move || crate::acp_runtime::inspect_adapter_model_control(adapter, cwd))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diagnostic_detail_redacts_secret_bearing_lines() {
        let detail = safe_detail("ready\nOPENAI_API_KEY=<configured>\nAuthorization: <configured>");
        assert_eq!(detail, "ready\n[redacted]\n[redacted]");
        assert!(!detail.contains("<configured>"));
    }

    #[test]
    fn version_attention_requires_declared_minimum() {
        assert_eq!(version_status(Some("demo 1.2.0"), Some("1.3.0")), "outdated");
        assert_eq!(version_status(Some("demo 1.3.1"), Some("1.3.0")), "ok");
        assert_eq!(version_status(Some("demo 1.0.0"), None), "unknown");
    }
}
