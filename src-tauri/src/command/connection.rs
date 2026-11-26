//! OpenProject connection commands.

use crate::model::connection::ConnectionTestResult;
use crate::service::connection;

#[tauri::command]
pub(crate) async fn test_openproject_connection(
    url: String,
    token: String,
) -> Result<ConnectionTestResult, String> {
    connection::test_openproject_connection(url, token).await
}

#[tauri::command]
pub(crate) async fn fetch_current_user_id(url: String, token: String) -> Result<String, String> {
    connection::fetch_current_user_id(url, token).await
}
