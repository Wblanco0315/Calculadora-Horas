//! Attachment upload DTO.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UploadedAttachment {
    pub id: String,
    pub file_name: String,
    pub content_type: String,
    pub download_url: String,
}
