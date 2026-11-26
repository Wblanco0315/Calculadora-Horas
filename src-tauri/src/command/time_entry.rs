//! Time entry commands.

use crate::model::time_entry::{TimeEntryActivityItem, UpdateTimeEntryPayload};
use crate::service::time_entry;

#[tauri::command]
pub(crate) async fn fetch_time_entry_activities(
    url: String,
    token: String,
    ticket: Option<String>,
) -> Result<Vec<TimeEntryActivityItem>, String> {
    time_entry::fetch_time_entry_activities(url, token, ticket).await
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub(crate) async fn create_time_entry(
    url: String,
    token: String,
    ticket: String,
    minutes: i32,
    date: String,
    comment: String,
    activity_type_id: Option<String>,
    project_id: Option<String>,
) -> Result<(), String> {
    time_entry::create_time_entry(url, token, ticket, minutes, date, comment, activity_type_id, project_id).await
}

#[tauri::command]
pub(crate) async fn update_work_package_time_entry(
    url: String,
    token: String,
    entry_id: String,
    payload: UpdateTimeEntryPayload,
) -> Result<(), String> {
    time_entry::update_work_package_time_entry(url, token, entry_id, payload).await
}
