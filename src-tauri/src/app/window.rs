//! Main window lifecycle: close hides to the tray.

use tauri::{Window, WindowEvent};

/// Closing the main window (title bar button, Alt+F4, taskbar) keeps the app running in the tray:
/// the window is only hidden. Quitting is done from the tray menu ("Salir").
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

