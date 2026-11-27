//! Application configuration commands (local SQLite).

use tauri::AppHandle;

use crate::model::config::AppConfig;
use crate::repository::connection::{self, open_connection};
use crate::repository::config;

#[tauri::command]
pub(crate) fn get_app_config(app: AppHandle) -> Result<Option<AppConfig>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    config::load_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    config::save_config(&conn, &config).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn check_is_configured(app: AppHandle) -> Result<bool, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    config::is_configured(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn get_database_path(app: AppHandle) -> Result<String, String> {
    let path = connection::get_db_path(&app);
    Ok(path.to_string_lossy().to_string())
}
