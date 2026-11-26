//! Main window bounds commands (compact/full mode switch, startup restore).

use tauri::WebviewWindow;

use crate::service::window;

/// Resizes the content area to `width` x `height` logical pixels in one step, keeping the window
/// center (or centering it in the monitor work area when `center` is true) on the current monitor.
#[tauri::command]
pub(crate) fn resize_window(window: WebviewWindow, width: f64, height: f64, center: bool) -> Result<(), String> {
    window::resize(&window, width, height, center)
}

/// Moves and resizes the window (logical position and content size) in one step.
#[tauri::command]
pub(crate) fn set_window_bounds(window: WebviewWindow, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    window::set_bounds(&window, x, y, width, height)
}

/// While maximized, sets the size (logical content px) the window gets back when un-maximized,
/// around the current restore rectangle or centered in the monitor work area (`center`).
#[tauri::command]
pub(crate) fn set_window_restore_size(window: WebviewWindow, width: f64, height: f64, center: bool) -> Result<(), String> {
    window::set_restore_size(&window, width, height, center)
}
