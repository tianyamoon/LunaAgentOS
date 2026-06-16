//! Adapter Host Module。
//! 负责发现 Adapter、解析启动参数与读取品牌资源，不承载具体 Agent Product 规则。

use crate::acp_runtime;
use crate::adapter_extensions;
use crate::adapter_registry;
use crate::runtime_config::load_runtime_config_file;
use std::fs;
use tauri::AppHandle;

/// 根据通用上下文解析 Adapter 启动参数。
/// Adapter Product 特例由 Adapter Extension 消化，通用 Adapter 使用 manifest 声明。
pub(crate) fn adapter_launch_spec_with_context(
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

/// 加载内置与用户扩展 Adapter Manifest。
#[tauri::command]
pub(crate) fn load_adapters(app: AppHandle) -> adapter_registry::AdapterLoadResult {
    let config = load_runtime_config_file(&app);
    adapter_registry::load_adapters(&config.adapter_plugin_paths)
}

/// 前端渲染 Adapter 图标所需的 data URL 原料。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AdapterIconPayload {
    mime: String,
    base64: String,
}

/// 根据文件扩展名推导图标 MIME 类型。
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

/// 读取 Manifest 声明的图标。
/// 图标缺失属于可恢复情况，返回 None 让前端使用文字占位。
#[tauri::command]
pub(crate) fn read_adapter_icon(
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
            crate::log_diagnostic(&format!(
                "read_adapter_icon: failed to read {} for {}: {}",
                path.display(),
                adapter_id,
                error
            ));
            return Ok(None);
        }
    };
    Ok(Some(AdapterIconPayload {
        mime: icon_mime_for_path(path).to_string(),
        base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
    }))
}
