//! Thin `#[tauri::command]` handlers. They only forward arguments to services or repositories.

pub(crate) mod activity;
pub(crate) mod app;
pub(crate) mod attachment;
pub(crate) mod board;
pub(crate) mod config;
pub(crate) mod connection;
pub(crate) mod favorite_ticket;
pub(crate) mod mcp;
pub(crate) mod project;
pub(crate) mod report;
pub(crate) mod statistic;
pub(crate) mod ticket;
pub(crate) mod time_entry;
pub(crate) mod work_package;
