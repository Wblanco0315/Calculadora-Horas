//! Work package commands.

use crate::model::work_package::{
    UpdateWorkPackagePayload, WorkPackageCostSummaryItem, WorkPackageFormSchemaResult,
    WorkPackageRevisionItem, WorkPackageSearchItem, WorkPackageUpdateStreamResult,
};
use crate::service::{work_package, work_package_edit};

#[tauri::command]
pub(crate) async fn update_work_package_status(
    url: String,
    token: String,
    ticket: String,
    status_id: String,
    lock_version: Option<i64>,
) -> Result<(), String> {
    work_package::update_work_package_status(url, token, ticket, status_id, lock_version).await
}

#[tauri::command]
pub(crate) async fn update_work_package_version(
    url: String,
    token: String,
    ticket: String,
    version_id: Option<String>,
    lock_version: Option<i64>,
) -> Result<(), String> {
    work_package::update_work_package_version(url, token, ticket, version_id, lock_version).await
}

#[tauri::command]
pub(crate) async fn fetch_work_package_form(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageFormSchemaResult, String> {
    work_package_edit::fetch_work_package_form(url, token, ticket).await
}

#[tauri::command]
pub(crate) async fn fetch_work_package_revisions(
    url: String,
    token: String,
    ticket_ids: Vec<String>,
) -> Result<Vec<WorkPackageRevisionItem>, String> {
    work_package::fetch_work_package_revisions(url, token, ticket_ids).await
}

#[tauri::command]
pub(crate) async fn search_work_packages(
    url: String,
    token: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WorkPackageSearchItem>, String> {
    work_package::search_work_packages(url, token, query, limit).await
}

#[tauri::command]
pub(crate) async fn fetch_work_package_update_stream(
    url: String,
    token: String,
    ticket: String,
    last_update_timestamp: String,
) -> Result<WorkPackageUpdateStreamResult, String> {
    work_package::fetch_work_package_update_stream(url, token, ticket, last_update_timestamp).await
}

#[tauri::command]
pub(crate) async fn update_work_package(
    url: String,
    token: String,
    ticket: String,
    payload: UpdateWorkPackagePayload,
) -> Result<i64, String> {
    work_package_edit::update_work_package(url, token, ticket, payload).await
}

#[tauri::command]
pub(crate) async fn add_work_package_comment(
    url: String,
    token: String,
    ticket: String,
    comment: String,
) -> Result<(), String> {
    work_package_edit::add_work_package_comment(url, token, ticket, comment).await
}

#[tauri::command]
pub(crate) async fn fetch_work_package_cost_summary(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageCostSummaryItem, String> {
    work_package::fetch_work_package_cost_summary(url, token, ticket).await
}
