mod db;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use db::{open_connection, ActivityRecord, AppConfig};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::AppHandle;

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
pub struct TicketInfoResult {
    pub success: bool,
    pub subject: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
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

fn build_auth_header(token: &str) -> String {
    format!("Basic {}", BASE64.encode(format!("apikey:{}", token.trim())))
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

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

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
            message: "Ticket no especificado.".to_string(),
        });
    }

    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
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

    Ok(TicketInfoResult {
        success: true,
        subject,
        project_id,
        project_name,
        status_id,
        status_name,
        status_color: None,
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

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/json")
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

#[tauri::command]
async fn fetch_time_entry_activities(
    url: String,
    token: String,
) -> Result<Vec<TimeEntryActivityItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/time_entries/activities", clean_url);
    let auth_value = build_auth_header(&token);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/json")
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
                list.push(TimeEntryActivityItem {
                    id: id.to_string(),
                    name: name.to_string(),
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

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&endpoint)
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
        Err(format!("Error enviando tiempo a OpenProject: {}", err_text))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
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
            create_time_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
