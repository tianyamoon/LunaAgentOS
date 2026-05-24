use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterLoadResult {
    pub adapters: Vec<AdapterDefinition>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterDefinition {
    pub id: String,
    pub name: String,
    pub version: Option<String>,
    pub description: Option<String>,
    pub transport: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
    pub cwd: Option<String>,
    pub requires_pty: bool,
    pub health_check: Option<AdapterHealthCheck>,
    pub capabilities: AdapterCapabilities,
    pub permissions: AdapterPermissions,
    pub source_path: String,
    pub manifest_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdapterHealthCheck {
    pub command: String,
    pub args: Vec<String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdapterCapabilities {
    #[serde(default)]
    pub streaming: bool,
    #[serde(default)]
    pub resume: bool,
    #[serde(default)]
    pub profiles: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdapterPermissions {
    #[serde(default)]
    pub process_exec: Vec<ProcessExecPermission>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessExecPermission {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawManifest {
    id: String,
    name: String,
    version: Option<String>,
    #[serde(default, alias = "schema_version")]
    schema_version: Option<u32>,
    description: Option<String>,
    contributes: Option<RawContributes>,
    transport: Option<String>,
    command: Option<CommandSpec>,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    cwd: Option<String>,
    #[serde(default, alias = "requires_pty")]
    requires_pty: bool,
    health_check: Option<RawHealthCheck>,
    #[serde(default)]
    capabilities: AdapterCapabilities,
    #[serde(default)]
    permissions: AdapterPermissions,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawContributes {
    #[serde(default)]
    acp_adapters: Vec<RawAdapterContribution>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RawAdapterContribution {
    id: String,
    name: String,
    description: Option<String>,
    transport: String,
    command: CommandSpec,
    #[serde(default)]
    args: Vec<String>,
    #[serde(default)]
    env: HashMap<String, String>,
    cwd: Option<String>,
    #[serde(default, alias = "requires_pty")]
    requires_pty: bool,
    health_check: Option<RawHealthCheck>,
    #[serde(default)]
    capabilities: AdapterCapabilities,
    #[serde(default)]
    permissions: AdapterPermissions,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RawHealthCheck {
    command: CommandSpec,
    #[serde(default)]
    args: Vec<String>,
    timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(untagged)]
enum CommandSpec {
    Program(String),
    ProgramAndArgs(Vec<String>),
}

impl CommandSpec {
    fn into_parts(self, extra_args: Vec<String>) -> Result<(String, Vec<String>), String> {
        match self {
            CommandSpec::Program(program) => Ok((program, extra_args)),
            CommandSpec::ProgramAndArgs(items) => {
                let Some((program, args)) = items.split_first() else {
                    return Err("command must not be empty".to_string());
                };
                let mut args = args.to_vec();
                args.extend(extra_args);
                Ok((program.clone(), args))
            }
        }
    }
}

pub fn default_plugin_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("adapters")
        .join("reference")
        .join("stdio")
        .join("plugins")
}

pub fn load_adapters(configured_paths: &[String]) -> AdapterLoadResult {
    let mut paths = vec![default_plugin_path()];
    paths.extend(
        configured_paths
            .iter()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(PathBuf::from),
    );

    let mut seen_paths = HashSet::new();
    let mut seen_ids = HashSet::new();
    let mut adapters = Vec::new();
    let mut warnings = Vec::new();

    for path in paths {
        let path_key = path.to_string_lossy().to_string();
        if !seen_paths.insert(path_key.clone()) {
            continue;
        }
        let Ok(entries) = fs::read_dir(&path) else {
            warnings.push(format!(
                "adapter plugin path not readable: {}",
                path.display()
            ));
            continue;
        };
        for entry in entries.flatten() {
            let manifest_path = entry.path().join("manifest.json");
            if !manifest_path.is_file() {
                continue;
            }
            match load_manifest_file(&manifest_path) {
                Ok(items) => {
                    for adapter in items {
                        if seen_ids.insert(adapter.id.clone()) {
                            adapters.push(adapter);
                        } else {
                            warnings.push(format!("duplicate adapter id skipped: {}", adapter.id));
                        }
                    }
                }
                Err(error) => warnings.push(format!("{}: {}", manifest_path.display(), error)),
            }
        }
    }

    adapters.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    AdapterLoadResult { adapters, warnings }
}

fn load_manifest_file(path: &Path) -> Result<Vec<AdapterDefinition>, String> {
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let manifest: RawManifest = serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    if manifest.schema_version.is_some_and(|version| version > 1) {
        return Err("unsupported adapter manifest schemaVersion".to_string());
    }
    let manifest_dir = path.parent().unwrap_or_else(|| Path::new("."));
    let source_path = path.to_string_lossy().to_string();

    if let Some(contributes) = manifest.contributes.as_ref() {
        return contributes
            .acp_adapters
            .iter()
            .cloned()
            .map(|adapter| {
                adapter_from_contribution(adapter, &manifest, manifest_dir, &source_path)
            })
            .collect();
    }

    let Some(transport) = manifest.transport else {
        return Err("manifest must define contributes.acpAdapters or transport".to_string());
    };
    let Some(command) = manifest.command else {
        return Err("manifest must define command".to_string());
    };
    let (command, args) = command.into_parts(manifest.args)?;
    Ok(vec![finalize_adapter(AdapterDefinition {
        id: manifest.id.clone(),
        name: manifest.name.clone(),
        version: manifest.version.clone(),
        description: manifest.description.clone(),
        transport,
        command,
        args,
        env: manifest.env,
        cwd: resolve_cwd(manifest.cwd, manifest_dir),
        requires_pty: manifest.requires_pty,
        health_check: raw_health_check(manifest.health_check)?,
        capabilities: manifest.capabilities,
        permissions: manifest.permissions,
        source_path,
        manifest_id: manifest.id,
    })])
}

fn adapter_from_contribution(
    adapter: RawAdapterContribution,
    manifest: &RawManifest,
    manifest_dir: &Path,
    source_path: &str,
) -> Result<AdapterDefinition, String> {
    let (command, args) = adapter.command.into_parts(adapter.args)?;
    Ok(finalize_adapter(AdapterDefinition {
        id: adapter.id,
        name: adapter.name,
        version: manifest.version.clone(),
        description: adapter.description.or_else(|| manifest.description.clone()),
        transport: adapter.transport,
        command,
        args,
        env: adapter.env,
        cwd: resolve_cwd(adapter.cwd, manifest_dir),
        requires_pty: adapter.requires_pty,
        health_check: raw_health_check(adapter.health_check)?,
        capabilities: adapter.capabilities,
        permissions: adapter.permissions,
        source_path: source_path.to_string(),
        manifest_id: manifest.id.clone(),
    }))
}

fn raw_health_check(value: Option<RawHealthCheck>) -> Result<Option<AdapterHealthCheck>, String> {
    value
        .map(|health| {
            let (command, args) = health.command.into_parts(health.args)?;
            Ok(AdapterHealthCheck {
                command,
                args,
                timeout_ms: health.timeout_ms,
            })
        })
        .transpose()
}

fn resolve_cwd(cwd: Option<String>, manifest_dir: &Path) -> Option<String> {
    match cwd {
        Some(value) if !value.trim().is_empty() => {
            let path = PathBuf::from(value.trim());
            let resolved = if path.is_absolute() {
                path
            } else {
                manifest_dir.join(path)
            };
            Some(resolved.to_string_lossy().to_string())
        }
        _ => Some(manifest_dir.to_string_lossy().to_string()),
    }
}

fn finalize_adapter(mut adapter: AdapterDefinition) -> AdapterDefinition {
    adapter.command = normalize_command_for_platform(adapter.command);
    if let Some(health) = adapter.health_check.as_mut() {
        health.command = normalize_command_for_platform(health.command.clone());
    }
    for permission in adapter.permissions.process_exec.iter_mut() {
        permission.command = normalize_command_for_platform(permission.command.clone());
    }
    if adapter.health_check.is_none() {
        adapter.health_check = Some(AdapterHealthCheck {
            command: adapter.command.clone(),
            args: vec!["--version".to_string()],
            timeout_ms: Some(8000),
        });
    }
    if adapter.permissions.process_exec.is_empty() {
        adapter
            .permissions
            .process_exec
            .push(ProcessExecPermission {
                command: adapter.command.clone(),
                args: wildcard_tail(adapter.args.clone()),
            });
        if let Some(health) = &adapter.health_check {
            adapter
                .permissions
                .process_exec
                .push(ProcessExecPermission {
                    command: health.command.clone(),
                    args: wildcard_tail(health.args.clone()),
                });
        }
    }
    adapter
}

fn normalize_command_for_platform(command: String) -> String {
    if !cfg!(windows) {
        return command;
    }
    let trimmed = command.trim();
    if trimmed.is_empty()
        || trimmed.contains('\\')
        || trimmed.contains('/')
        || Path::new(trimmed).extension().is_some()
    {
        return command;
    }
    let Some(paths) = env::var_os("PATH") else {
        return command;
    };
    let pathext = env::var_os("PATHEXT")
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| ".COM;.EXE;.BAT;.CMD".to_string());
    for dir in env::split_paths(&paths) {
        let direct = dir.join(trimmed);
        if direct.is_file() {
            return direct.to_string_lossy().to_string();
        }
        for ext in pathext.split(';').filter(|item| !item.trim().is_empty()) {
            let candidate = dir.join(format!("{trimmed}{}", ext.trim()));
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }
    command
}

fn wildcard_tail(mut args: Vec<String>) -> Vec<String> {
    args.push("**".to_string());
    args
}

pub fn allow_process_exec(
    adapter: &AdapterDefinition,
    command: &str,
    args: &[String],
) -> Result<(), String> {
    if adapter
        .permissions
        .process_exec
        .iter()
        .any(|permission| permission.command == command && args_match(&permission.args, args))
    {
        return Ok(());
    }
    Err(format!(
        "adapter {} does not declare processExec permission for {} {:?}",
        adapter.id, command, args
    ))
}

fn args_match(pattern: &[String], args: &[String]) -> bool {
    let mut pattern_index = 0;
    let mut arg_index = 0;
    while pattern_index < pattern.len() {
        match pattern[pattern_index].as_str() {
            "**" => return true,
            "*" => {
                if arg_index >= args.len() {
                    return false;
                }
                pattern_index += 1;
                arg_index += 1;
            }
            expected => {
                if args.get(arg_index).map(String::as_str) != Some(expected) {
                    return false;
                }
                pattern_index += 1;
                arg_index += 1;
            }
        }
    }
    arg_index == args.len()
}

pub fn find_adapter(
    configured_paths: &[String],
    adapter_id: &str,
) -> Result<AdapterDefinition, String> {
    load_adapters(configured_paths)
        .adapters
        .into_iter()
        .find(|adapter| adapter.id == adapter_id)
        .ok_or_else(|| format!("adapter not found: {adapter_id}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn process_exec_supports_double_star_tail() {
        let adapter = AdapterDefinition {
            id: "codex".to_string(),
            name: "Codex".to_string(),
            version: None,
            description: None,
            transport: "stdio_json".to_string(),
            command: "npx".to_string(),
            args: vec!["-y".to_string(), "@openai/codex".to_string()],
            env: HashMap::new(),
            cwd: None,
            requires_pty: false,
            health_check: None,
            capabilities: AdapterCapabilities::default(),
            permissions: AdapterPermissions {
                process_exec: vec![ProcessExecPermission {
                    command: "npx".to_string(),
                    args: vec![
                        "-y".to_string(),
                        "@openai/codex".to_string(),
                        "**".to_string(),
                    ],
                }],
            },
            source_path: "".to_string(),
            manifest_id: "codex".to_string(),
        };
        assert!(
            allow_process_exec(&adapter, "npx", &["-y".into(), "@openai/codex".into()]).is_ok()
        );
        assert!(allow_process_exec(
            &adapter,
            "npx",
            &["-y".into(), "@openai/codex".into(), "--version".into()]
        )
        .is_ok());
        assert!(allow_process_exec(&adapter, "node", &[]).is_err());
    }
}
