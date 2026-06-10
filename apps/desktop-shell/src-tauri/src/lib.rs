mod acp_runtime;
mod adapter_host;
mod adapter_extensions;
mod adapter_registry;
mod history_repository;
mod runtime_config;
mod runtime_probe;
mod runtime_session_commands;

use adapter_host::{load_adapters, read_adapter_icon};
use history_repository::{
    append_history_entry, archive_history_session_entries, compact_history_entries,
    delete_history_session_entries, load_history_entries,
};
use runtime_config::{
    load_runtime_config, load_user_themes, save_runtime_config, RuntimeConfigFile,
};
use runtime_probe::{
    adapter_instance_probe, adapter_provider_probe, is_configured, provider_probe_from_instances,
    run_shell, runtime_adapter_model_control, runtime_adapter_probe, runtime_adapter_slash_commands, runtime_adapter_targets,
    runtime_instance_probe, runtime_probe, RuntimeInstanceProbe, RuntimeProviderProbe,
};
use runtime_session_commands::{
    runtime_acp_adapter_alive_ids, runtime_acp_adapter_load, runtime_acp_adapter_prompt,
    runtime_acp_adapter_resume, runtime_acp_adapter_shutdown,
};

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
            runtime_adapter_model_control,
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
