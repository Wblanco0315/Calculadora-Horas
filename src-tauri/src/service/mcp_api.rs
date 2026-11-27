//! Local API for the PocketProject MCP (served by `ipc.rs` at `POST /api/<operation>` and
//! `POST /action`).
//!
//! PocketProject is the only intermediary: the MCP sends an operation name and JSON arguments,
//! and the app answers with its own repositories (SQLite) and OpenProject services. The OpenProject
//! URL and token never leave the app.
//!
//! Rules enforced here (the system prompt asks the same of the AI):
//! - Lookups go to local data first (favorites, activity history, statistics cache) and to
//!   OpenProject only when local data cannot answer. Results say where they came from (`source`).
//! - Writes to OpenProject require the `lock_version` the AI read, so a ticket changed meanwhile
//!   is never overwritten.
//! - Attachments are read or downloaded only with `user_authorized: true`, and only from the
//!   configured OpenProject origin (checked again in `openproject::client::request_attachment`).
//! - Comments and uploads are never done by the AI: `draft_comment` / `upload_attachment` are
//!   interface actions; the user sends or uploads from the ticket detail.

use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::model::activity::ActivityRecord;
use crate::model::favorite_ticket::FavoriteTicketRecord;
use crate::model::time_entry::TimeCostReportFilter;
use crate::model::work_package::UpdateWorkPackagePayload;
use crate::repository::connection::open_connection;
use crate::repository::{activity, config, favorite_ticket};
use crate::service::{
    attachment, board, board_move, connection, project, report, statistic, ticket, ticket_context,
    work_package, work_package_edit,
};

/// Operations of `POST /api/<operation>` (also listed by `/ping`).
pub(crate) const OPERATIONS: &[&str] = &[
    // Local data
    "app_context",
    "activities",
    "activity_save",
    "activity_delete",
    "favorites",
    "favorite_save",
    // Local first, then OpenProject
    "search_tickets",
    "ticket_info",
    "ticket_context",
    "time_statistics",
    // OpenProject reads
    "current_user",
    "projects",
    "statuses",
    "project_versions",
    "boards",
    "board_columns",
    "ticket_form",
    "ticket_costs",
    "time_cost_report",
    // OpenProject writes (after the user authorizes them in the chat)
    "update_status",
    "update_version",
    "update_fields",
    "move_column",
    // Attachments (after the user authorizes them in the chat)
    "attachment_content",
    "attachment_download",
];

/// Actions of `POST /action` (also listed by `/ping`).
pub(crate) const ACTIONS: &[&str] = &[
    "open_app",
    "set_mode",
    "navigate",
    "open_ticket",
    "draft_comment",
    "upload_attachment",
];

/// Views `navigate` accepts (routes of the full dashboard, plus the compact window).
const VIEWS: &[&str] = &[
    "compact",
    "overview",
    "time-entries",
    "projects",
    "boards",
    "board",
    "ticket",
    "reports",
    "settings",
];

pub(crate) async fn dispatch(app: &AppHandle, operation: &str, body: Value) -> Result<Value, String> {
    match operation {
        // ── Local data ────────────────────────────────────────────────
        "app_context" => app_context(app),
        "activities" => {
            let date: Option<String> = opt(&body, "date")?;
            let conn = open_connection(app).map_err(|e| e.to_string())?;
            to_value(activity::load_activities(&conn, date.as_deref()).map_err(|e| e.to_string())?)
        }
        "activity_save" => {
            let record: ActivityRecord = req(&body, "activity")?;
            let conn = open_connection(app).map_err(|e| e.to_string())?;
            activity::save_activity(&conn, &record).map_err(|e| e.to_string())?;
            notify_changed(app, "activity_saved", json!({ "id": record.id }));
            to_value(record)
        }
        "activity_delete" => {
            let id: String = req(&body, "id")?;
            let conn = open_connection(app).map_err(|e| e.to_string())?;
            activity::delete_activity(&conn, &id).map_err(|e| e.to_string())?;
            notify_changed(app, "activity_deleted", json!({ "id": id }));
            Ok(json!({ "id": id }))
        }
        "favorites" => {
            let conn = open_connection(app).map_err(|e| e.to_string())?;
            to_value(favorite_ticket::load_favorite_tickets(&conn).map_err(|e| e.to_string())?)
        }
        "favorite_save" => {
            let record: FavoriteTicketRecord = serde_json::from_value(body).map_err(|e| e.to_string())?;
            let conn = open_connection(app).map_err(|e| e.to_string())?;
            favorite_ticket::save_favorite_ticket(&conn, &record).map_err(|e| e.to_string())?;
            notify_changed(app, "favorite_saved", json!({ "ticket": record.ticket }));
            to_value(record)
        }

        // ── Local first, then OpenProject ─────────────────────────────
        "search_tickets" => search_tickets(app, &body).await,
        "ticket_info" => ticket_info(app, &body).await,
        "ticket_context" => ticket_context_local_first(app, &body).await,
        "time_statistics" => {
            let from: String = req(&body, "from")?;
            let refresh: bool = opt(&body, "refresh")?.unwrap_or(false);
            if refresh {
                let to: String = req(&body, "to")?;
                let (url, token) = credentials(app)?;
                to_value(statistic::refresh(app, url, token, from, to).await?)
            } else {
                to_value(statistic::load_cached(app, &from)?)
            }
        }

        // ── OpenProject reads ─────────────────────────────────────────
        "current_user" => {
            let (url, token) = credentials(app)?;
            to_value(connection::test_openproject_connection(url, token).await?)
        }
        "projects" => {
            let (url, token) = credentials(app)?;
            to_value(project::fetch_openproject_projects(url, token).await?)
        }
        "statuses" => {
            let (url, token) = credentials(app)?;
            to_value(project::fetch_statuses(url, token).await?)
        }
        "project_versions" => {
            let project_id: String = req(&body, "project_id")?;
            let (url, token) = credentials(app)?;
            to_value(project::fetch_project_versions(url, token, project_id).await?)
        }
        "boards" => {
            let project_id: String = req(&body, "project_id")?;
            let identifier: Option<String> = opt(&body, "project_identifier")?;
            let (url, token) = credentials(app)?;
            to_value(board::fetch_project_boards(url, token, project_id, identifier).await?)
        }
        "board_columns" => {
            let board_id: String = req(&body, "board_id")?;
            let (url, token) = credentials(app)?;
            to_value(board::fetch_board_columns(url, token, board_id).await?)
        }
        "ticket_form" => {
            let ticket = ticket_id(&body)?;
            let (url, token) = credentials(app)?;
            to_value(work_package_edit::fetch_work_package_form(url, token, ticket).await?)
        }
        "ticket_costs" => {
            let ticket = ticket_id(&body)?;
            let (url, token) = credentials(app)?;
            to_value(work_package::fetch_work_package_cost_summary(url, token, ticket).await?)
        }
        "time_cost_report" => {
            let filter: TimeCostReportFilter = opt(&body, "filter")?.unwrap_or_default();
            let (url, token) = credentials(app)?;
            to_value(report::load_time_cost_report_entries(url, token, filter).await?)
        }

        // ── OpenProject writes ────────────────────────────────────────
        "update_status" => {
            let ticket = ticket_id(&body)?;
            let status_id: String = req(&body, "status_id")?;
            let lock_version = lock_version(&body)?;
            let (url, token) = credentials(app)?;
            work_package::update_work_package_status(url, token, ticket.clone(), status_id, Some(lock_version)).await?;
            notify_ticket_updated(app, &ticket);
            Ok(json!({ "ticket": ticket }))
        }
        "update_version" => {
            let ticket = ticket_id(&body)?;
            let version_id: Option<String> = opt(&body, "version_id")?;
            let lock_version = lock_version(&body)?;
            let (url, token) = credentials(app)?;
            work_package::update_work_package_version(url, token, ticket.clone(), version_id, Some(lock_version)).await?;
            notify_ticket_updated(app, &ticket);
            Ok(json!({ "ticket": ticket }))
        }
        "update_fields" => {
            let ticket = ticket_id(&body)?;
            let mut fields: UpdateWorkPackagePayload = req(&body, "fields")?;
            fields.lock_version = Some(lock_version(&body)?);
            let (url, token) = credentials(app)?;
            let new_lock_version =
                work_package_edit::update_work_package(url, token, ticket.clone(), fields).await?;
            notify_ticket_updated(app, &ticket);
            Ok(json!({ "ticket": ticket, "lockVersion": new_lock_version }))
        }
        "move_column" => {
            let ticket = ticket_id(&body)?;
            let target_query_id: String = req(&body, "target_query_id")?;
            let source_query_id: Option<String> = opt(&body, "source_query_id")?;
            let target_status_id: Option<String> = opt(&body, "target_status_id")?;
            let lock_version = lock_version(&body)?;
            let (url, token) = credentials(app)?;
            let result = board_move::move_work_package_to_board_column(
                url,
                token,
                ticket.clone(),
                target_query_id,
                source_query_id,
                target_status_id,
                None,
                None,
                Some(lock_version),
            )
            .await?;
            notify_ticket_updated(app, &ticket);
            to_value(result)
        }

        // ── Attachments ───────────────────────────────────────────────
        "attachment_content" => {
            require_user_authorization(&body)?;
            let download_url: String = req(&body, "download_url")?;
            let (url, token) = credentials(app)?;
            ensure_openproject_origin(&url, &download_url)?;
            Ok(json!({ "content": attachment::fetch_attachment_content(url, token, download_url).await? }))
        }
        "attachment_download" => {
            require_user_authorization(&body)?;
            let download_url: String = req(&body, "download_url")?;
            let file_name: String = req(&body, "file_name")?;
            let (url, token) = credentials(app)?;
            ensure_openproject_origin(&url, &download_url)?;
            let path = attachment::download_work_package_attachment(app.clone(), url, token, download_url, file_name).await?;
            Ok(json!({ "path": path }))
        }

        other => Err(format!(
            "Operación desconocida: '{}'. Disponibles: {}",
            other,
            OPERATIONS.join(", ")
        )),
    }
}

/// Interface action: shows the window and lets the frontend (`McpActionService`) carry it out.
/// Comments and uploads only prepare the interface; the user sends or uploads.
pub(crate) fn run_action(app: &AppHandle, body: Value) -> Result<Value, String> {
    let action: String = req(&body, "action")?;
    match action.as_str() {
        "open_app" => {}
        "set_mode" => {
            let mode: String = req(&body, "mode")?;
            if mode != "compact" && mode != "full" {
                return Err("mode debe ser 'compact' o 'full'".to_string());
            }
        }
        "navigate" => {
            let view: String = req(&body, "view")?;
            if !VIEWS.contains(&view.as_str()) {
                return Err(format!("Vista desconocida: '{}'. Disponibles: {}", view, VIEWS.join(", ")));
            }
        }
        "open_ticket" | "upload_attachment" => {
            ticket_id(&body)?;
        }
        "draft_comment" => {
            ticket_id(&body)?;
            let text: String = req(&body, "text")?;
            if text.trim().is_empty() {
                return Err("El comentario está vacío".to_string());
            }
        }
        other => {
            return Err(format!("Acción desconocida: '{}'. Disponibles: {}", other, ACTIONS.join(", ")));
        }
    }
    crate::app::window::show_main_window(app);
    app.emit("mcp-action", &body).map_err(|e| e.to_string())?;
    Ok(json!({ "action": action }))
}

// ──────────────────────────────────────────────────────────────────────
// Local-first lookups
// ──────────────────────────────────────────────────────────────────────

/// Configuration the AI may know (no token).
fn app_context(app: &AppHandle) -> Result<Value, String> {
    let conn = open_connection(app).map_err(|e| e.to_string())?;
    let cfg = config::load_config(&conn).map_err(|e| e.to_string())?;
    Ok(match cfg {
        Some(c) => json!({
            "isConfigured": c.is_configured,
            "openprojectUrl": c.openproject_url,
            "hasToken": !c.openproject_token.trim().is_empty(),
            "userName": c.user_name,
            "userLogin": c.user_login,
            "language": c.language,
            "entryTime": c.entry_time,
            "exitTime": c.exit_time,
            "lunchMinutes": c.lunch_minutes,
            "minDailyMinutes": c.min_daily_minutes,
            "schedule": c.schedule_json.and_then(|s| serde_json::from_str::<Value>(&s).ok()),
        }),
        None => json!({ "isConfigured": false }),
    })
}

/// A ticket known locally: from favorites or from the activity history.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalTicket {
    pub ticket: String,
    pub title: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub is_favorite: bool,
    pub local_minutes: i64,
    pub last_date: Option<String>,
}

/// Merges favorites and activities into one entry per ticket (favorites first).
pub(crate) fn local_tickets(favorites: &[FavoriteTicketRecord], activities: &[ActivityRecord]) -> Vec<LocalTicket> {
    let mut tickets: Vec<LocalTicket> = favorites
        .iter()
        .map(|f| LocalTicket {
            ticket: normalize_ticket(&f.ticket),
            title: Some(f.title.clone()),
            project_id: f.project_id.clone(),
            project_name: f.project_name.clone(),
            is_favorite: true,
            local_minutes: 0,
            last_date: None,
        })
        .collect();
    for act in activities {
        let Some(raw) = act.ticket.as_deref().filter(|t| !t.trim().is_empty()) else {
            continue;
        };
        let key = normalize_ticket(raw);
        let index = match tickets.iter().position(|t| t.ticket == key) {
            Some(index) => index,
            None => {
                tickets.push(LocalTicket {
                    ticket: key,
                    title: None,
                    project_id: None,
                    project_name: None,
                    is_favorite: false,
                    local_minutes: 0,
                    last_date: None,
                });
                tickets.len() - 1
            }
        };
        let entry = &mut tickets[index];
        entry.local_minutes += i64::from(act.minutes);
        if entry.title.is_none() {
            entry.title = act.ticket_title.clone();
        }
        if entry.project_name.is_none() {
            entry.project_id = act.project_id.clone();
            entry.project_name = act.project_name.clone();
        }
        if entry.last_date.as_deref().is_none_or(|d| d < act.date.as_str()) {
            entry.last_date = Some(act.date.clone());
        }
    }
    tickets
}

/// Local tickets matching `query`: the ticket number (`#123`, `123`) or text in title/project.
pub(crate) fn search_local(tickets: &[LocalTicket], query: &str) -> Vec<LocalTicket> {
    let query = query.trim();
    let number = normalize_ticket(query);
    let is_number = !number.is_empty() && number.chars().all(|c| c.is_ascii_digit());
    let needle = query.to_lowercase();
    tickets
        .iter()
        .filter(|t| {
            if is_number {
                return t.ticket == number;
            }
            [t.title.as_deref(), t.project_name.as_deref()]
                .into_iter()
                .flatten()
                .any(|text| text.to_lowercase().contains(&needle))
        })
        .cloned()
        .collect()
}

fn load_local_tickets(app: &AppHandle) -> Result<Vec<LocalTicket>, String> {
    let conn = open_connection(app).map_err(|e| e.to_string())?;
    let favorites = favorite_ticket::load_favorite_tickets(&conn).map_err(|e| e.to_string())?;
    let activities = activity::load_activities(&conn, None).map_err(|e| e.to_string())?;
    Ok(local_tickets(&favorites, &activities))
}

async fn search_tickets(app: &AppHandle, body: &Value) -> Result<Value, String> {
    let query: String = req(body, "query")?;
    let limit: Option<u32> = opt(body, "limit")?;
    let local = search_local(&load_local_tickets(app)?, &query);
    if !local.is_empty() {
        return Ok(json!({ "source": "local", "items": local }));
    }
    let (url, token) = credentials(app)?;
    let remote = work_package::search_work_packages(url, token, query, limit.or(Some(20))).await?;
    Ok(json!({ "source": "openproject", "items": remote }))
}

async fn ticket_info(app: &AppHandle, body: &Value) -> Result<Value, String> {
    let ticket = ticket_id(body)?;
    if let Some(local) = load_local_tickets(app)?
        .into_iter()
        .find(|t| t.ticket == ticket && t.title.is_some())
    {
        return Ok(json!({ "source": "local", "ticket": local }));
    }
    let (url, token) = credentials(app)?;
    let info = ticket::fetch_ticket_info(url, token, ticket).await?;
    Ok(json!({ "source": "openproject", "ticket": info }))
}

/// Local summary always; OpenProject only when the request needs data that is not local
/// (description, comments, attachments, current status/lockVersion) or the ticket is unknown here.
async fn ticket_context_local_first(app: &AppHandle, body: &Value) -> Result<Value, String> {
    let ticket = ticket_id(body)?;
    let local_only: bool = opt(body, "local_only")?.unwrap_or(false);
    let include_description: Option<bool> = opt(body, "include_description")?;
    let include_comments: Option<bool> = opt(body, "include_comments")?;
    let include_attachments: Option<bool> = opt(body, "include_attachments")?;

    let local = load_local_tickets(app)?.into_iter().find(|t| t.ticket == ticket);
    if local_only {
        return Ok(json!({ "source": "local", "local": local }));
    }
    let (url, token) = credentials(app)?;
    let remote = ticket_context::fetch_ticket_context(
        url,
        token,
        ticket,
        include_description,
        include_comments,
        include_attachments,
    )
    .await?;
    Ok(json!({ "source": "openproject", "local": local, "openproject": remote }))
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

fn credentials(app: &AppHandle) -> Result<(String, String), String> {
    let conn = open_connection(app).map_err(|e| e.to_string())?;
    let cfg = config::load_config(&conn)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "PocketProject no está configurado todavía.".to_string())?;
    if cfg.openproject_token.trim().is_empty() {
        return Err("PocketProject no tiene un token de OpenProject configurado.".to_string());
    }
    Ok((cfg.openproject_url, cfg.openproject_token))
}

fn req<T: DeserializeOwned>(body: &Value, key: &str) -> Result<T, String> {
    let value = body.get(key).filter(|v| !v.is_null()).ok_or_else(|| format!("Falta el parámetro '{}'", key))?;
    serde_json::from_value(value.clone()).map_err(|e| format!("Parámetro '{}' inválido: {}", key, e))
}

fn opt<T: DeserializeOwned>(body: &Value, key: &str) -> Result<Option<T>, String> {
    match body.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(value) => serde_json::from_value(value.clone())
            .map(Some)
            .map_err(|e| format!("Parámetro '{}' inválido: {}", key, e)),
    }
}

fn to_value<T: serde::Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|e| e.to_string())
}

fn normalize_ticket(raw: &str) -> String {
    raw.trim().trim_start_matches('#').trim().to_string()
}

/// `ticket` as a work package number (accepts `#123`, `"123"` or `123`).
fn ticket_id(body: &Value) -> Result<String, String> {
    let raw = match body.get("ticket") {
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::String(s)) => s.clone(),
        _ => return Err("Falta el parámetro 'ticket'".to_string()),
    };
    let ticket = normalize_ticket(&raw);
    if ticket.is_empty() || !ticket.chars().all(|c| c.is_ascii_digit()) {
        return Err(format!("Ticket inválido: '{}'", raw));
    }
    Ok(ticket)
}

fn lock_version(body: &Value) -> Result<i64, String> {
    opt::<i64>(body, "lock_version")?.ok_or_else(|| {
        "Falta 'lock_version': consulta el ticket (get_ticket_context) y envía el lockVersion recibido."
            .to_string()
    })
}

fn require_user_authorization(body: &Value) -> Result<(), String> {
    if opt::<bool>(body, "user_authorized")? == Some(true) {
        Ok(())
    } else {
        Err("El usuario debe autorizar expresamente en el chat la lectura o descarga del adjunto (user_authorized: true).".to_string())
    }
}

/// Attachments are only fetched from the configured OpenProject (relative URLs or the same origin),
/// so the API key is never sent to another host.
pub(crate) fn ensure_openproject_origin(openproject_url: &str, download_url: &str) -> Result<(), String> {
    let download_url = download_url.trim();
    if !(download_url.starts_with("http://") || download_url.starts_with("https://")) {
        return Ok(());
    }
    let base = crate::openproject::url::sanitize_url(openproject_url);
    let expected = crate::openproject::url::openproject_origin(&base).to_lowercase();
    let actual = crate::openproject::url::openproject_origin(download_url).to_lowercase();
    if expected == actual {
        Ok(())
    } else {
        Err(format!("El adjunto no pertenece al servidor de OpenProject configurado ({}).", expected))
    }
}

fn notify_changed(app: &AppHandle, event: &str, data: Value) {
    let payload = json!({ "event": event, "data": data, "source": "mcp" });
    let _ = app.emit("db-changed", &payload);
    let _ = app.emit("mcp-event", &payload);
}

fn notify_ticket_updated(app: &AppHandle, ticket: &str) {
    let _ = app.emit("mcp-event", &json!({ "event": "ticket_updated", "data": { "ticket": ticket }, "source": "mcp" }));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn favorite(ticket: &str, title: &str) -> FavoriteTicketRecord {
        FavoriteTicketRecord {
            ticket: ticket.into(),
            title: title.into(),
            project_id: Some("1".into()),
            project_name: Some("Demo".into()),
        }
    }

    fn activity(ticket: &str, title: &str, minutes: i32, date: &str) -> ActivityRecord {
        serde_json::from_value(json!({
            "id": format!("{ticket}-{date}"),
            "name": "x",
            "minutes": minutes,
            "date": date,
            "ticket": ticket,
            "ticketTitle": title,
            "projectName": "Banco",
        }))
        .unwrap()
    }

    #[test]
    fn local_tickets_merge_favorites_and_history() {
        let tickets = local_tickets(
            &[favorite("#12", "Login")],
            &[activity("12", "Login", 30, "2026-11-20"), activity("8", "Reporte", 45, "2026-11-21")],
        );
        assert_eq!(tickets.len(), 2);
        assert_eq!(tickets[0].ticket, "12");
        assert!(tickets[0].is_favorite);
        assert_eq!(tickets[0].local_minutes, 30);
        assert_eq!(tickets[1].title.as_deref(), Some("Reporte"));
        assert_eq!(tickets[1].project_name.as_deref(), Some("Banco"));
    }

    #[test]
    fn local_search_by_number_or_text() {
        let tickets = local_tickets(&[favorite("12", "Login form")], &[activity("8", "Reporte mensual", 45, "2026-11-21")]);
        assert_eq!(search_local(&tickets, "#12").len(), 1);
        assert_eq!(search_local(&tickets, "1").len(), 0);
        assert_eq!(search_local(&tickets, "reporte")[0].ticket, "8");
        assert_eq!(search_local(&tickets, "banco")[0].ticket, "8");
        assert!(search_local(&tickets, "nada").is_empty());
    }

    #[test]
    fn attachments_only_from_the_configured_openproject() {
        let base = "https://op.example.com/openproject";
        assert!(ensure_openproject_origin(base, "/api/v3/attachments/5/content").is_ok());
        assert!(ensure_openproject_origin(base, "https://op.example.com/api/v3/attachments/5/content").is_ok());
        assert!(ensure_openproject_origin(base, "https://evil.example.net/steal").is_err());
        assert!(ensure_openproject_origin(base, "https://op.example.com.evil.net/x").is_err());
    }

    #[test]
    fn writes_need_lock_version_and_attachments_need_authorization() {
        assert!(lock_version(&json!({})).is_err());
        assert_eq!(lock_version(&json!({ "lock_version": 4 })).unwrap(), 4);
        assert!(require_user_authorization(&json!({})).is_err());
        assert!(require_user_authorization(&json!({ "user_authorized": false })).is_err());
        assert!(require_user_authorization(&json!({ "user_authorized": true })).is_ok());
    }

    #[test]
    fn ticket_ids_are_validated() {
        assert_eq!(ticket_id(&json!({ "ticket": "#45" })).unwrap(), "45");
        assert_eq!(ticket_id(&json!({ "ticket": 45 })).unwrap(), "45");
        assert!(ticket_id(&json!({ "ticket": "45; drop" })).is_err());
        assert!(ticket_id(&json!({})).is_err());
    }
}
