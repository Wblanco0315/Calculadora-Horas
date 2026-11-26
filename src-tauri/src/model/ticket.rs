//! Ticket info / ticket context DTOs.

use serde::{Deserialize, Serialize};

use crate::model::project::StatusOptionItem;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct TicketInfoResult {
    pub success: bool,
    pub subject: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub version_id: Option<String>,
    pub version_name: Option<String>,
    pub lock_version: Option<i64>,
    pub available_statuses: Option<Vec<StatusOptionItem>>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct TicketDescriptionItem {
    pub raw: Option<String>,
    pub html: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TicketActivityDetailItem {
    pub raw: String,
    pub html: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TicketCommentItem {
    pub id: String,
    #[serde(alias = "comment_raw")]
    pub comment_raw: String,
    #[serde(alias = "comment_html")]
    pub comment_html: String,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "user_name")]
    pub user_name: String,
    #[serde(default)]
    pub details: Vec<TicketActivityDetailItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TicketAttachmentItem {
    pub id: String,
    #[serde(alias = "file_name")]
    pub file_name: String,
    #[serde(alias = "file_size")]
    pub file_size: i64,
    #[serde(alias = "content_type")]
    pub content_type: String,
    #[serde(alias = "download_url")]
    pub download_url: String,
    #[serde(alias = "is_image")]
    pub is_image: bool,
    #[serde(alias = "created_at")]
    pub created_at: Option<String>,
    #[serde(alias = "author_name")]
    pub author_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct TicketContextResult {
    pub success: bool,
    pub ticket: String,
    pub subject: Option<String>,
    pub type_name: Option<String>,
    pub author_name: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub description: Option<TicketDescriptionItem>,
    pub comments: Option<Vec<TicketCommentItem>>,
    pub attachments: Option<Vec<TicketAttachmentItem>>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub version_id: Option<String>,
    pub version_name: Option<String>,
    pub priority_name: Option<String>,
    pub assignee_name: Option<String>,
    pub responsible_name: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub estimated_time: Option<String>,
    pub spent_time: Option<String>,
    pub lock_version: Option<i64>,
    pub available_statuses: Option<Vec<StatusOptionItem>>,
    pub message: String,
}
