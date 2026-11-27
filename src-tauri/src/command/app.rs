//! Application lifecycle commands.

use tauri::AppHandle;

use crate::ipc;

#[tauri::command]
pub(crate) fn exit_app(app: AppHandle) {
    ipc::cleanup_ipc_file(&app);
    app.exit(0);
}
