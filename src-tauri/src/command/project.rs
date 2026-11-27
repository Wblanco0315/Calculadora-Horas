//! Project, version and status commands.

use crate::model::project::{OpenProjectProjectItem, StatusOptionItem, VersionOptionItem};
use crate::service::project;

#[tauri::command]
pub(crate) async fn fetch_openproject_projects(
    url: String,
    token: String,
) -> Result<Vec<OpenProjectProjectItem>, String> {
    project::fetch_openproject_projects(url, token).await
}

#[tauri::command]
pub(crate) async fn fetch_project_versions(
    url: String,
    token: String,
    project_id: String,
) -> Result<Vec<VersionOptionItem>, String> {
    project::fetch_project_versions(url, token, project_id).await
}

#[tauri::command]
pub(crate) async fn fetch_statuses(
    url: String,
    token: String,
) -> Result<Vec<StatusOptionItem>, String> {
    project::fetch_statuses(url, token).await
}
