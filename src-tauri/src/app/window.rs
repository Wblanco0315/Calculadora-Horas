//! Window event handling.

use tauri::{Emitter, Window, WindowEvent};

/// Closing the main window is delegated to the frontend through the `close-requested` event.
pub(crate) fn handle_window_event(window: &Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.emit("close-requested", ());
    }
}
