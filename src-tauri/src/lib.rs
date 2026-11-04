mod db;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use db::{open_connection, ActivityRecord, AppConfig};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub user_name: Option<String>,
    pub user_login: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct OpenProjectUserResponse {
    name: Option<String>,
    login: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusOptionItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionOptionItem {
    pub id: String,
    pub name: String,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketInfoResult {
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
pub struct OpenProjectProjectItem {
    pub id: String,
    pub name: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeEntryActivityItem {
    pub id: String,
    pub name: String,
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> Result<Option<AppConfig>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::load_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::save_config(&conn, &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_is_configured(app: AppHandle) -> Result<bool, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::is_configured(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_activities(app: AppHandle, date: Option<String>) -> Result<Vec<ActivityRecord>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::load_activities(&conn, date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_activity(app: AppHandle, activity: ActivityRecord) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::save_activity(&conn, &activity).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_activity(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::delete_activity(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_activities(app: AppHandle, date: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::clear_activities_for_date(&conn, &date).map_err(|e| e.to_string())
}

fn sanitize_url(url: &str) -> String {
    let mut clean = url.trim().trim_end_matches('/').to_string();
    if clean.is_empty() {
        clean = "https://openproject.wposs.com/openproject".to_string();
    }
    if clean.ends_with("/api/v3") {
        clean = clean[..clean.len() - 7].to_string();
    }
    clean
}

const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(BROWSER_USER_AGENT)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))
}

fn build_auth_header(token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.starts_with("opapi-") || trimmed.starts_with("Bearer ") {
        if trimmed.starts_with("Bearer ") {
            trimmed.to_string()
        } else {
            format!("Bearer {}", trimmed)
        }
    } else {
        format!("Basic {}", BASE64.encode(format!("apikey:{}", trimmed)))
    }
}

#[tauri::command]
async fn test_openproject_connection(
    url: String,
    token: String,
) -> Result<ConnectionTestResult, String> {
    let trimmed_token = token.trim();
    if trimmed_token.is_empty() {
        return Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: "El token de acceso no puede estar vacío.".to_string(),
        });
    }

    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/users/me", clean_url);
    let auth_value = build_auth_header(trimmed_token);
    let client = build_http_client(12)?;

    let response = match client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(res) => res,
        Err(err) => {
            return Ok(ConnectionTestResult {
                success: false,
                user_name: None,
                user_login: None,
                message: format!("No se pudo conectar con el servidor: {}", err),
            });
        }
    };

    let status = response.status();
    if status.is_success() {
        match response.json::<OpenProjectUserResponse>().await {
            Ok(user) => Ok(ConnectionTestResult {
                success: true,
                user_name: user.name.clone(),
                user_login: user.login,
                message: format!(
                    "¡Conexión exitosa! Bienvenido/a {}.",
                    user.name.unwrap_or_else(|| "Usuario".to_string())
                ),
            }),
            Err(e) => Ok(ConnectionTestResult {
                success: false,
                user_name: None,
                user_login: None,
                message: format!("Respuesta inválida del servidor OpenProject: {}", e),
            }),
        }
    } else if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: "Token inválido o permisos insuficientes (401/403).".to_string(),
        })
    } else {
        Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: format!("El servidor respondió con código HTTP {}", status),
        })
    }
}

#[tauri::command]
async fn fetch_ticket_info(
    url: String,
    token: String,
    ticket: String,
) -> Result<TicketInfoResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    if raw_ticket.is_empty() {
        return Ok(TicketInfoResult {
            success: false,
            subject: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            lock_version: None,
            available_statuses: None,
            message: "Ticket no especificado.".to_string(),
        });
    }

    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if !res.status().is_success() {
        return Ok(TicketInfoResult {
            success: false,
            subject: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            lock_version: None,
            available_statuses: None,
            message: format!("Error HTTP {}", res.status()),
        });
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let subject = json_val["subject"].as_str().map(|s| s.to_string());
    let project_name = json_val["_links"]["project"]["title"].as_str().map(|s| s.to_string());
    let project_id = json_val["_links"]["project"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_name = json_val["_links"]["status"]["title"].as_str().map(|s| s.to_string());
    let status_id = json_val["_links"]["status"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_color = json_val["_embedded"]["status"]["color"]
        .as_str()
        .or_else(|| json_val["status"]["color"].as_str())
        .map(|s| s.to_string());

    let version_name = json_val["_links"]["version"]["title"].as_str().map(|s| s.to_string());
    let version_id = json_val["_links"]["version"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let lock_version = json_val["lockVersion"].as_i64();

    // Query form endpoint to fetch allowed statuses
    let form_endpoint = format!("{}/api/v3/work_packages/{}/form", clean_url, raw_ticket);
    let mut available_statuses: Option<Vec<StatusOptionItem>> = None;

    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .body("{}")
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let schema_status = &form_json["_embedded"]["schema"]["status"];
                let allowed_raw = schema_status["allowedValues"]
                    .as_array()
                    .or_else(|| schema_status["_links"]["allowedValues"].as_array());

                if let Some(arr) = allowed_raw {
                    let mut list = Vec::new();
                    for item in arr {
                        let id = item["id"]
                            .as_i64()
                            .map(|i| i.to_string())
                            .or_else(|| item["href"].as_str().and_then(|h| h.split('/').last().map(|s| s.to_string())));
                        let name = item["name"]
                            .as_str()
                            .or_else(|| item["title"].as_str())
                            .map(|s| s.to_string());
                        let color = item["color"].as_str().map(|s| s.to_string());

                        if let (Some(id_str), Some(name_str)) = (id, name) {
                            list.push(StatusOptionItem {
                                id: id_str,
                                name: name_str,
                                color,
                            });
                        }
                    }
                    if !list.is_empty() {
                        available_statuses = Some(list);
                    }
                }
            }
        }
    }

    Ok(TicketInfoResult {
        success: true,
        subject,
        project_id,
        project_name,
        status_id,
        status_name,
        status_color,
        version_id,
        version_name,
        lock_version,
        available_statuses,
        message: "Ticket cargado".to_string(),
    })
}

#[tauri::command]
async fn fetch_openproject_projects(
    url: String,
    token: String,
) -> Result<Vec<OpenProjectProjectItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/projects?pageSize=100", clean_url);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(15)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let identifier = el["identifier"].as_str().map(|s| s.to_string());
                list.push(OpenProjectProjectItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    identifier,
                });
            }
        }
    }

    Ok(list)
}

fn parse_activity_schema(json_val: &serde_json::Value) -> Vec<TimeEntryActivityItem> {
    let mut list = Vec::new();
    let schema_activity = json_val
        .get("_embedded")
        .and_then(|e| e.get("schema"))
        .and_then(|s| s.get("activity"))
        .or_else(|| json_val.get("schema").and_then(|s| s.get("activity")));

    if let Some(act) = schema_activity {
        // 1. Embedded allowedValues
        if let Some(embedded_values) = act
            .get("_embedded")
            .and_then(|e| e.get("allowedValues"))
            .and_then(|v| v.as_array())
        {
            for el in embedded_values {
                let id = el.get("id").and_then(|n| n.as_i64()).map(|n| n.to_string())
                    .or_else(|| el.get("id").and_then(|s| s.as_str()).map(|s| s.to_string()))
                    .or_else(|| {
                        el.get("_links")
                            .and_then(|l| l.get("self"))
                            .and_then(|s| s.get("href"))
                            .and_then(|h| h.as_str())
                            .and_then(|h| h.split('/').filter(|s| !s.is_empty()).last())
                            .map(|s| s.to_string())
                    });
                let name = el.get("name").and_then(|s| s.as_str()).map(|s| s.to_string())
                    .or_else(|| el.get("_links").and_then(|l| l.get("self")).and_then(|s| s.get("title")).and_then(|t| t.as_str()).map(|s| s.to_string()));

                if let (Some(id), Some(name)) = (id, name) {
                    list.push(TimeEntryActivityItem { id, name });
                }
            }
        }

        // 2. Linked allowedValues
        if list.is_empty() {
            let link_values = act
                .get("_links")
                .and_then(|l| l.get("allowedValues"))
                .and_then(|v| v.as_array())
                .or_else(|| act.get("allowedValues").and_then(|v| v.as_array()));

            if let Some(links) = link_values {
                for el in links {
                    let id = el.get("href")
                        .and_then(|h| h.as_str())
                        .and_then(|h| h.split('/').filter(|s| !s.is_empty()).last())
                        .map(|s| s.to_string())
                        .or_else(|| el.get("id").and_then(|n| n.as_i64()).map(|n| n.to_string()))
                        .or_else(|| el.get("id").and_then(|s| s.as_str()).map(|s| s.to_string()));
                    let name = el.get("title").and_then(|t| t.as_str()).map(|s| s.to_string())
                        .or_else(|| el.get("name").and_then(|s| s.as_str()).map(|s| s.to_string()));

                    if let (Some(id), Some(name)) = (id, name) {
                        list.push(TimeEntryActivityItem { id, name });
                    }
                }
            }
        }
    }
    list
}

#[tauri::command]
async fn fetch_time_entry_activities(
    url: String,
    token: String,
    ticket: Option<String>,
) -> Result<Vec<TimeEntryActivityItem>, String> {
    let clean_url = sanitize_url(&url);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let form_endpoint = format!("{}/api/v3/time_entries/form", clean_url);

    // 1. If ticket is provided, query POST /api/v3/time_entries/form with workPackage link
    let raw_ticket = ticket.as_deref().map(|t| t.trim().trim_start_matches('#')).filter(|s| !s.is_empty());
    if let Some(wp_id) = raw_ticket {
        let payload = serde_json::json!({
            "_links": {
                "workPackage": { "href": format!("/api/v3/work_packages/{}", wp_id) }
            }
        });
        if let Ok(res) = client
            .post(&form_endpoint)
            .header("Authorization", &auth_value)
            .header("Content-Type", "application/json")
            .header("Accept", "application/hal+json, application/json")
            .body(payload.to_string())
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(json_val) = res.json::<serde_json::Value>().await {
                    let items = parse_activity_schema(&json_val);
                    if !items.is_empty() {
                        return Ok(items);
                    }
                }
            }
        }
    }

    // 2. Discover via GET /api/v3/work_packages?pageSize=1 to get user's accessible work package
    let wp_sample_endpoint = format!("{}/api/v3/work_packages?pageSize=1", clean_url);
    if let Ok(res) = client
        .get(&wp_sample_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json_val) = res.json::<serde_json::Value>().await {
                if let Some(elements) = json_val.get("_embedded").and_then(|e| e.get("elements")).and_then(|el| el.as_array()) {
                    if let Some(first) = elements.first() {
                        let sample_id = first.get("id").and_then(|id| id.as_i64()).map(|n| n.to_string())
                            .or_else(|| first.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()));
                        if let Some(wp_id) = sample_id {
                            let payload = serde_json::json!({
                                "_links": {
                                    "workPackage": { "href": format!("/api/v3/work_packages/{}", wp_id) }
                                }
                            });
                            if let Ok(form_res) = client
                                .post(&form_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/hal+json, application/json")
                                .body(payload.to_string())
                                .send()
                                .await
                            {
                                if form_res.status().is_success() {
                                    if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                                        let items = parse_activity_schema(&form_json);
                                        if !items.is_empty() {
                                            return Ok(items);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Discover via GET /api/v3/projects?pageSize=1
    let proj_sample_endpoint = format!("{}/api/v3/projects?pageSize=1", clean_url);
    if let Ok(res) = client
        .get(&proj_sample_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json_val) = res.json::<serde_json::Value>().await {
                if let Some(elements) = json_val.get("_embedded").and_then(|e| e.get("elements")).and_then(|el| el.as_array()) {
                    if let Some(first) = elements.first() {
                        let sample_id = first.get("id").and_then(|id| id.as_i64()).map(|n| n.to_string())
                            .or_else(|| first.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()));
                        if let Some(pid) = sample_id {
                            let payload = serde_json::json!({
                                "_links": {
                                    "project": { "href": format!("/api/v3/projects/{}", pid) }
                                }
                            });
                            if let Ok(form_res) = client
                                .post(&form_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/hal+json, application/json")
                                .body(payload.to_string())
                                .send()
                                .await
                            {
                                if form_res.status().is_success() {
                                    if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                                        let items = parse_activity_schema(&form_json);
                                        if !items.is_empty() {
                                            return Ok(items);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Try POST /api/v3/time_entries/form with empty body
    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .body("{}")
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let items = parse_activity_schema(&form_json);
                if !items.is_empty() {
                    return Ok(items);
                }
            }
        }
    }

    // 5. Fallback to GET /api/v3/time_entries/activities if form endpoint was unavailable
    let endpoint = format!("{}/api/v3/time_entries/activities", clean_url);
    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    let elements_opt = json_val["_embedded"]["elements"]
        .as_array()
        .or_else(|| json_val["elements"].as_array());

    if let Some(elements) = elements_opt {
        for el in elements {
            let id = if let Some(n) = el["id"].as_i64() {
                Some(n.to_string())
            } else if let Some(s) = el["id"].as_str() {
                Some(s.to_string())
            } else if let Some(href) = el["_links"]["self"]["href"].as_str() {
                href.split('/').filter(|s| !s.is_empty()).last().map(|s| s.to_string())
            } else {
                None
            };

            let name = if let Some(n) = el["name"].as_str() {
                Some(n.to_string())
            } else if let Some(t) = el["_links"]["self"]["title"].as_str() {
                Some(t.to_string())
            } else {
                None
            };

            if let (Some(id), Some(name)) = (id, name) {
                list.push(TimeEntryActivityItem {
                    id,
                    name,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn create_time_entry(
    url: String,
    token: String,
    ticket: String,
    minutes: i32,
    date: String,
    comment: String,
    activity_type_id: Option<String>,
    project_id: Option<String>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/time_entries", clean_url);
    let auth_value = build_auth_header(&token);

    let hours_float = (minutes as f64) / 60.0;
    let iso_duration = format!("PT{:.2}H", hours_float);

    let mut links = serde_json::json!({
        "workPackage": { "href": format!("/api/v3/work_packages/{}", raw_ticket) }
    });

    if let Some(pid) = project_id {
        if !pid.trim().is_empty() {
            links["project"] = serde_json::json!({ "href": format!("/api/v3/projects/{}", pid) });
        }
    }

    if let Some(aid) = activity_type_id {
        if !aid.trim().is_empty() {
            links["activity"] = serde_json::json!({ "href": format!("/api/v3/time_entries/activities/{}", aid) });
        }
    }

    let payload = serde_json::json!({
        "comment": { "format": "plain", "raw": comment },
        "spentOn": date,
        "hours": iso_duration,
        "_links": links
    });

    let client = build_http_client(15)?;

    let res = client
        .post(&endpoint)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error enviando tiempo a OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn update_work_package_status(
    url: String,
    token: String,
    ticket: String,
    status_id: String,
    lock_version: Option<i64>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let actual_lock_version = match lock_version {
        Some(lv) => lv,
        None => {
            let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
            let res = client
                .get(&wp_url)
                .header("Authorization", &auth_value)
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let patch_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let payload = serde_json::json!({
        "lockVersion": actual_lock_version,
        "_links": {
            "status": {
                "href": format!("/api/v3/statuses/{}", status_id)
            }
        }
    });

    let res = client
        .patch(&patch_url)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error actualizando estado en OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn update_work_package_version(
    url: String,
    token: String,
    ticket: String,
    version_id: Option<String>,
    lock_version: Option<i64>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let actual_lock_version = match lock_version {
        Some(lv) => lv,
        None => {
            let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
            let res = client
                .get(&wp_url)
                .header("Authorization", &auth_value)
                .header("Accept", "application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let patch_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let version_href = match version_id {
        Some(vid) if !vid.trim().is_empty() => serde_json::json!({ "href": format!("/api/v3/versions/{}", vid) }),
        _ => serde_json::json!({ "href": null }),
    };

    let payload = serde_json::json!({
        "lockVersion": actual_lock_version,
        "_links": {
            "version": version_href
        }
    });

    let res = client
        .patch(&patch_url)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error actualizando versión en OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn fetch_project_versions(
    url: String,
    token: String,
    project_id: String,
) -> Result<Vec<VersionOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/projects/{}/versions", clean_url, project_id.trim());
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let status = el["status"].as_str().map(|s| s.to_string());
                list.push(VersionOptionItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    status,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn fetch_statuses(
    url: String,
    token: String,
) -> Result<Vec<StatusOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/statuses", clean_url);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let color = el["color"].as_str().map(|s| s.to_string());
                list.push(StatusOptionItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    color,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle();

            let show_item = MenuItem::with_id(handle, "show", "Abrir PocketProject", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(handle, "quit", "Salir", true, None::<&str>)?;
            let tray_menu = Menu::with_items(handle, &[&show_item, &quit_item])?;

            let mut builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("PocketProject")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            let _tray = builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            save_app_config,
            check_is_configured,
            test_openproject_connection,
            get_activities,
            save_activity,
            delete_activity,
            clear_activities,
            fetch_ticket_info,
            fetch_openproject_projects,
            fetch_time_entry_activities,
            create_time_entry,
            update_work_package_status,
            update_work_package_version,
            fetch_project_versions,
            fetch_statuses,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
