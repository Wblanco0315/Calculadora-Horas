//! Project, version and status DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct OpenProjectProjectItem {
    pub id: String,
    pub name: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct VersionOptionItem {
    pub id: String,
    pub name: String,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct StatusOptionItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}
