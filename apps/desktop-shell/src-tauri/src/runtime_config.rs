//! 运行时配置 Module。
//! 集中管理本地配置文件与用户主题目录，避免 composition root 理解磁盘布局。

use crate::acp_runtime;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// 用户为 Agent Entry 保存的双语职责简报。
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AgentBriefConfig {
    pub(crate) text: String,
    #[serde(default)]
    pub(crate) source: Option<String>,
    #[serde(default)]
    pub(crate) updated_at: Option<String>,
}

/// 桌面 Shell 的本地运行时配置文件。
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RuntimeConfigFile {
    pub(crate) claude_command: Option<String>,
    #[serde(default)]
    pub(crate) claude_args: Vec<String>,
    pub(crate) hermes_host: Option<String>,
    pub(crate) hermes_command: Option<String>,
    #[serde(default)]
    pub(crate) adapter_plugin_paths: Vec<String>,
    #[serde(default)]
    pub(crate) agent_briefs: HashMap<String, HashMap<String, AgentBriefConfig>>,
}

/// ACP runtime 当前不需要读取桌面配置，但保留显式转换 Seam。
impl From<RuntimeConfigFile> for acp_runtime::RuntimeConfig {
    fn from(_value: RuntimeConfigFile) -> Self {
        acp_runtime::RuntimeConfig
    }
}

/// 返回 LunaAgentOS 本地配置文件路径，并确保父目录存在。
fn runtime_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    let base_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&base_dir).map_err(|error| error.to_string())?;
    Ok(base_dir.join("runtime-config.json"))
}

/// 容错读取配置文件。文件不存在或损坏时返回默认配置。
pub(crate) fn load_runtime_config_file(app: &AppHandle) -> RuntimeConfigFile {
    let Ok(path) = runtime_config_path(app) else {
        return RuntimeConfigFile::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return RuntimeConfigFile::default();
    };
    serde_json::from_str::<RuntimeConfigFile>(&raw).unwrap_or_default()
}

/// 暴露给前端的配置读取命令。
#[tauri::command]
pub(crate) fn load_runtime_config(app: AppHandle) -> Result<RuntimeConfigFile, String> {
    Ok(load_runtime_config_file(&app))
}

/// 返回用户可扩展主题目录。
fn user_themes_dir(app: &AppHandle) -> Option<PathBuf> {
    let home = app.path().home_dir().ok()?;
    Some(home.join(".lunaagentos").join("themes"))
}

/// 读取用户主题。单个损坏文件不会阻断其余主题加载。
#[tauri::command]
pub(crate) fn load_user_themes(app: AppHandle) -> Vec<Value> {
    let Some(dir) = user_themes_dir(&app) else {
        return Vec::new();
    };
    if !dir.is_dir() {
        return Vec::new();
    }
    let Ok(read_dir) = fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut themes = Vec::new();
    for entry in read_dir.flatten() {
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = fs::read_to_string(&path) else {
            eprintln!("跳过无法读取的用户主题文件 {}", path.display());
            continue;
        };
        match serde_json::from_str::<Value>(&raw) {
            Ok(value) => themes.push(value),
            Err(error) => {
                eprintln!(
                    "跳过解析失败的用户主题文件 {}：{}",
                    path.display(),
                    error
                );
            }
        }
    }
    themes
}

/// 持久化运行时配置，并将最终保存内容返回给前端。
#[tauri::command]
pub(crate) fn save_runtime_config(
    app: AppHandle,
    config: RuntimeConfigFile,
) -> Result<RuntimeConfigFile, String> {
    let path = runtime_config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;
    fs::write(path, json).map_err(|error| error.to_string())?;
    Ok(config)
}
