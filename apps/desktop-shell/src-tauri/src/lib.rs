use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::process::Command;
use tauri::{AppHandle, Emitter};

mod acp_runtime;
mod adapter_extensions;
mod adapter_registry;
mod history_repository;
mod runtime_config;

use history_repository::{
    append_history_entry, archive_history_session_entries, compact_history_entries,
    delete_history_session_entries, load_history_entries,
};
use runtime_config::{
    load_runtime_config, load_runtime_config_file, load_user_themes, save_runtime_config,
    RuntimeConfigFile,
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn classify_backend_error(error: String) -> String {
    let lower = error.to_lowercase();
    let code = if lower.contains("session")
        && (lower.contains("not found") || lower.contains("不存在"))
    {
        "SESSION_NOT_FOUND"
    } else if lower.contains("permission") || lower.contains("denied") || lower.contains("权限") {
        "PERMISSION_DENIED"
    } else if lower.contains("missing executable") || lower.contains("no such file or directory") {
        "RUNTIME_DEPENDENCY_MISSING"
    } else if lower.contains("启动 claude acp adapter 失败")
        || lower.contains("启动 hermes acp adapter 失败")
        || lower.contains("not recognized")
        || lower.contains("not found")
        || lower.contains("cannot find")
        || lower.contains("找不到")
    {
        "RUNTIME_NOT_FOUND"
    } else if lower.contains("json") || lower.contains("parse") || lower.contains("解析") {
        "PROTOCOL_PARSE_FAILED"
    } else if lower.contains("broken pipe")
        || lower.contains("child")
        || lower.contains("进程")
        || lower.contains("已关闭 stdout")
        || lower.contains("closed stdout")
    {
        "RUNTIME_EXITED"
    } else {
        "UNKNOWN"
    };
    format!("[{code}] {error}")
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProviderProbe {
    provider_id: String,
    configured: bool,
    available: bool,
    command: String,
    summary: String,
    detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeProbeResult {
    providers: Vec<RuntimeProviderProbe>,
    instances: Vec<RuntimeInstanceProbe>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeInstanceProbe {
    id: String,
    provider_id: String,
    runtime_label: String,
    command_kind: String,
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    transport: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    adapter_source_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    capabilities: Option<adapter_registry::AdapterCapabilities>,
    configured: bool,
    available: bool,
    summary: String,
    detail: String,
    version: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeSessionStreamPayload {
    runtime_session_id: String,
    event: Value,
}

fn build_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

fn run_shell(shell: &str, args: &[&str]) -> Result<String, String> {
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

fn is_configured(value: &Option<String>) -> bool {
    value.as_ref().is_some_and(|item| !item.trim().is_empty())
}

fn first_output_line(output: &str) -> Option<String> {
    output
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

fn runtime_instance_probe(
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

fn provider_probe_from_instances(
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

fn adapter_instance_probe(adapter: &adapter_registry::AdapterDefinition) -> RuntimeInstanceProbe {
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
    let summary = if available {
        "available"
    } else {
        "unavailable"
    };
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

fn adapter_provider_probe(
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

fn adapter_launch_spec_with_context(
    app: &AppHandle,
    adapter_id: &str,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<acp_runtime::AdapterLaunchSpec, String> {
    let config = load_runtime_config_file(app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, adapter_id)?;
    if adapter.identity_only {
        return Err(format!("adapter {adapter_id} is identity-only and cannot be launched"));
    }
    if let Some(result) = adapter_extensions::build_launch_spec(
        &adapter,
        &config,
        adapter_extensions::AdapterLaunchContext {
            runtime_host,
            runtime_command: runtime_command.clone(),
            profile_executable,
        },
    ) {
        return result;
    }
    adapter_extensions::generic_launch_spec(adapter, runtime_command)
}

#[tauri::command]
fn load_adapters(app: AppHandle) -> adapter_registry::AdapterLoadResult {
    let config = load_runtime_config_file(&app);
    adapter_registry::load_adapters(&config.adapter_plugin_paths)
}

#[tauri::command]
fn runtime_adapter_probe(
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

#[tauri::command]
fn runtime_probe(app: AppHandle) -> RuntimeProbeResult {
    let config = load_runtime_config_file(&app);
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
fn runtime_adapter_targets(
    app: AppHandle,
    adapter_id: String,
    runtime_instance_id: Option<String>,
) -> Result<Vec<Value>, String> {
    let config = load_runtime_config_file(&app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)?;
    adapter_extensions::adapter_targets(&adapter, &config, runtime_instance_id.as_deref())
        .unwrap_or_else(|| Ok(Vec::new()))
}

#[tauri::command]
fn runtime_adapter_slash_commands(
    app: AppHandle,
    adapter_id: String,
    runtime_instance_id: Option<String>,
) -> Result<Vec<adapter_registry::SlashCommandCapability>, String> {
    let config = load_runtime_config_file(&app);
    let adapter = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)?;
    adapter_extensions::slash_commands(&adapter, &config, runtime_instance_id.as_deref())
        .unwrap_or_else(|| Ok(Vec::new()))
}

// Payload returned by `read_adapter_icon`. The shell composes a `data:` URL
// from `mime` + `base64` and feeds it directly into `<img src>`. We use
// base64 (vs a Vec<u8>) because Tauri's default JSON encoding would
// serialise raw bytes as an array of numbers — ~4x larger.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AdapterIconPayload {
    mime: String,
    base64: String,
}

// Pick a MIME type from a file extension. We deliberately keep this list
// short — adapter icons are expected to be SVG or PNG. Unknown extensions
// fall back to `application/octet-stream` so the webview at least logs a
// clear "image failed to load" rather than mis-interpreting the bytes.
fn icon_mime_for_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "application/octet-stream",
    }
}

// Read the icon file declared by an adapter manifest's `icon` field and
// return it as a base64 payload. The shell calls this once per adapter
// at startup (see `loadAdapterIcons` in main.js) to populate an in-memory
// icon registry; first-letter badges are used until the call completes
// or when the adapter declares no icon.
//
// Failure modes (returns `Ok(None)`):
//   - adapter id not found in the registry
//   - manifest declares no `icon` field
//   - resolved icon path does not exist on disk
//   - icon file is unreadable (permissions, transient I/O)
// `Err` is reserved for programmer-visible bugs; transient/expected
// misses are swallowed so a single bad adapter cannot break the rest.
#[tauri::command]
fn read_adapter_icon(
    app: AppHandle,
    adapter_id: String,
) -> Result<Option<AdapterIconPayload>, String> {
    use base64::Engine;
    let config = load_runtime_config_file(&app);
    let Ok(adapter) = adapter_registry::find_adapter(&config.adapter_plugin_paths, &adapter_id)
    else {
        return Ok(None);
    };
    let Some(icon_path) = adapter.icon_path.as_ref() else {
        return Ok(None);
    };
    let path = std::path::Path::new(icon_path);
    if !path.is_file() {
        return Ok(None);
    }
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) => {
            eprintln!(
                "read_adapter_icon: failed to read {} for {}: {}",
                path.display(),
                adapter_id,
                error
            );
            return Ok(None);
        }
    };
    Ok(Some(AdapterIconPayload {
        mime: icon_mime_for_path(path).to_string(),
        base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    }))
}

#[tauri::command]
async fn runtime_acp_adapter_prompt(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    prompt: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let runtime_session_id_for_emit = runtime_session_id.clone();
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut emit_update = |event: Value| {
            let payload = RuntimeSessionStreamPayload {
                runtime_session_id: runtime_session_id_for_emit.clone(),
                event,
            };
            let _ = app.emit("runtime-session-update", payload);
        };
        acp_runtime::run_adapter_acp_prompt(
            adapter,
            runtime_session_id,
            prompt,
            cwd,
            config,
            Some(&mut emit_update),
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_adapter_resume(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::resume_adapter_acp_session(
            adapter,
            runtime_session_id,
            acp_session_id,
            cwd,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_adapter_alive_ids(adapter_id: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::list_live_adapter_acp_sessions(adapter_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?
    .map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_adapter_shutdown(
    adapter_id: String,
    runtime_session_id: String,
) -> Result<bool, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::shutdown_adapter_acp_session(adapter_id, runtime_session_id)
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[tauri::command]
async fn runtime_acp_adapter_load(
    app: AppHandle,
    adapter_id: String,
    runtime_session_id: String,
    acp_session_id: String,
    cwd: Option<String>,
    runtime_host: Option<String>,
    runtime_command: Option<String>,
    profile_executable: Option<String>,
) -> Result<Vec<Value>, String> {
    let adapter = adapter_launch_spec_with_context(
        &app,
        &adapter_id,
        runtime_host,
        runtime_command,
        profile_executable,
    )?;
    let config = acp_runtime::RuntimeConfig::from(load_runtime_config_file(&app));
    let result = tauri::async_runtime::spawn_blocking(move || {
        acp_runtime::load_adapter_acp_session(
            adapter,
            runtime_session_id,
            acp_session_id,
            cwd,
            config,
        )
    })
    .await
    .map_err(|error| classify_backend_error(error.to_string()))?;
    result.map_err(classify_backend_error)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_history_entries,
            compact_history_entries,
            delete_history_session_entries,
            archive_history_session_entries,
            append_history_entry,
            load_runtime_config,
            save_runtime_config,
            load_user_themes,
            read_adapter_icon,
            load_adapters,
            runtime_probe,
            runtime_adapter_probe,
            runtime_adapter_targets,
            runtime_adapter_slash_commands,
            runtime_acp_adapter_prompt,
            runtime_acp_adapter_resume,
            runtime_acp_adapter_load,
            runtime_acp_adapter_shutdown,
            runtime_acp_adapter_alive_ids
        ])
        .on_window_event(|_window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let _ = acp_runtime::shutdown_all_adapter_acp_sessions();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
