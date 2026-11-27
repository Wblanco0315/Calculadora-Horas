//! Work package attachment commands.

use tauri::AppHandle;

use crate::model::attachment::UploadedAttachment;
use crate::service::attachment;

#[tauri::command]
pub(crate) async fn fetch_attachment_content(
    url: String,
    token: String,
    download_url: String,
) -> Result<String, String> {
    attachment::fetch_attachment_content(url, token, download_url).await
}

#[tauri::command]
pub(crate) async fn download_work_package_attachment(
    app: AppHandle,
    url: String,
    token: String,
    download_url: String,
    file_name: String,
) -> Result<String, String> {
    attachment::download_work_package_attachment(app, url, token, download_url, file_name).await
}

#[tauri::command]
pub(crate) async fn upload_work_package_attachment(
    url: String,
    token: String,
    ticket: String,
    file_name: String,
    content_type: String,
    data_base64: String,
) -> Result<UploadedAttachment, String> {
    attachment::upload_work_package_attachment(url, token, ticket, file_name, content_type, data_base64).await
}
