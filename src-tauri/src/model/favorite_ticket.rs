//! Favorite ticket record.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FavoriteTicketRecord {
    pub ticket: String,
    pub title: String,
    #[serde(default, alias = "project_id")]
    pub project_id: Option<String>,
    #[serde(default, alias = "project_name")]
    pub project_name: Option<String>,
}
