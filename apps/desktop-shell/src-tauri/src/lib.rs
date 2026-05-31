use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

mod acp_runtime;
mod adapter_host;
mod adapter_extensions;
mod adapter_registry;
mod history_repository;
mod runtime_config;
mod runtime_probe;

use adapter_host::{adapter_launch_spec_with_context, load_adapters, read_adapter_icon};
use history_repository::{
    append_history_entry, archive_history_session_entries, compact_history_entries,
    delete_history_session_entries, load_history_entries,
};
use runtime_config::{
    load_runtime_config, load_runtime_config_file, load_user_themes, save_runtime_config,
    RuntimeConfigFile,
};
use runtime_probe::{
    adapter_instance_probe, adapter_provider_probe, is_configured, provider_probe_from_instances,
    run_shell, runtime_adapter_probe, runtime_adapter_slash_commands, runtime_adapter_targets,
    runtime_instance_probe, runtime_probe, RuntimeInstanceProbe, RuntimeProviderProbe,
};

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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RuntimeSessionStreamPayload {
    runtime_session_id: String,
    event: Value,
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
