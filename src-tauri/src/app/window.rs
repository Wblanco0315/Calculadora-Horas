//! Main window lifecycle: close hides to the tray, and the single running instance is brought back.

use tauri::{AppHandle, Manager, Window, WindowEvent};

/// Closing the main window (title bar button, Alt+F4, taskbar) keeps the app running in the tray:
/// the window is only hidden. Quitting is done from the tray menu ("Salir").
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

/// Shows, restores and focuses the main window (tray click, tray menu, second launch).
pub(crate) fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
