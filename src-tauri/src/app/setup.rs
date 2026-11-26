//! Tauri `setup` hook: IPC server, autostart, minimized start and tray.

use tauri::{App, Manager};

use crate::app::tray;
use crate::ipc;
use crate::service::mcp_contract;

pub(crate) fn setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle();

    // Start the local IPC server for real-time communication with the PocketProject MCP
    if let Err(e) = ipc::start_ipc_server(handle.clone()) {
        eprintln!("[PocketProject IPC] Failed to start local server: {}", e);
    }

    // Publish the MCP compatibility contract (protocol version + system prompt) for pocketproject-mcp
    if let Err(e) = mcp_contract::write_contract_file(handle) {
        eprintln!("[PocketProject MCP] Failed to write contract file: {}", e);
    }

    // Keep every project's injected AI rules in sync with the prompt of this app version
    let rules_handle = handle.clone();
    std::thread::spawn(move || {
        crate::service::mcp::refresh_registered_rules(&rules_handle);
    });

    // Enable launching at operating system startup. Only release builds register it:
    // `enable()` stores the current executable path, so a dev run (`tauri dev`) would point
    // the OS startup entry at `target/debug`, which cannot start without the dev server.
    #[cfg(not(debug_assertions))]
    {
        use tauri_plugin_autostart::ManagerExt;
        let autostart_manager = app.autolaunch();
        let _ = autostart_manager.enable();
    }

    // When launched at startup with --minimized, hide the window
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == "--minimized") {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.hide();
        }
    }

    tray::build_tray(app)?;

    Ok(())
}
