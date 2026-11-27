//! Connection test DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub(crate) struct ConnectionTestResult {
    pub success: bool,
    pub user_name: Option<String>,
    pub user_login: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct OpenProjectUserResponse {
    pub name: Option<String>,
    pub login: Option<String>,
}
