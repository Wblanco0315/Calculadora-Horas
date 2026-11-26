//! Local activity commands (local SQLite).

use tauri::AppHandle;

use crate::model::activity::ActivityRecord;
use crate::repository::activity;
use crate::repository::connection::open_connection;
use crate::repository::statistic;

#[tauri::command]
pub(crate) fn get_activities(app: AppHandle, date: Option<String>) -> Result<Vec<ActivityRecord>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    activity::load_activities(&conn, date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn save_activity(app: AppHandle, activity: ActivityRecord) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    activity::save_activity(&conn, &activity).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn delete_activity(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    activity::delete_activity(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn clear_activities(app: AppHandle, date: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    activity::clear_activities_for_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn get_ai_stats(app: AppHandle) -> Result<i32, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    statistic::count_ai_activities(&conn).map_err(|e| e.to_string())
}
