//! Persisted application configuration.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct AppConfig {
    pub entry_time: String,
    pub exit_time: String,
    pub lunch_minutes: u32,
    pub openproject_url: String,
    pub openproject_token: String,
    pub theme_mode: String,
    pub primary_color: String,
    pub is_configured: bool,
    #[serde(default)]
    pub schedule_json: Option<String>,
    #[serde(default = "default_language")]
    pub language: Option<String>,
    #[serde(default)]
    pub user_name: Option<String>,
    #[serde(default)]
    pub user_login: Option<String>,
    #[serde(default = "default_min_daily_minutes")]
    pub min_daily_minutes: Option<u32>,
}

pub(crate) fn default_min_daily_minutes() -> Option<u32> {
    Some(510)
}

pub(crate) fn default_language() -> Option<String> {
    Some("es".to_string())
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            entry_time: "08:00".to_string(),
            exit_time: "17:30".to_string(),
            lunch_minutes: 60,
            openproject_url: "https://openproject.wposs.com/openproject".to_string(),
            openproject_token: String::new(),
            theme_mode: "system".to_string(),
            primary_color: "indigo".to_string(),
            is_configured: false,
            schedule_json: None,
            language: Some("es".to_string()),
            user_name: None,
            user_login: None,
            min_daily_minutes: Some(510),
        }
    }
}
