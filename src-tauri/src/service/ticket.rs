//! Ticket summary (`fetch_ticket_info`) with allowed status transitions.

use crate::model::project::StatusOptionItem;
use crate::model::ticket::TicketInfoResult;
use crate::service::project::fetch_statuses;
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_ticket_info(
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
        .header("Accept", "application/hal+json, application/json")
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
    let form_body = match lock_version {
        Some(lv) => serde_json::json!({ "lockVersion": lv }).to_string(),
        None => "{}".to_string(),
    };

    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .body(form_body)
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let schema_status = &form_json["_embedded"]["schema"]["status"];
                let allowed_raw = schema_status["_embedded"]["allowedValues"]
                    .as_array()
                    .or_else(|| schema_status["allowedValues"].as_array())
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

    // Resilient fallback: if form did not return available statuses, fetch all project statuses
    if available_statuses.as_ref().map_or(true, |v| v.is_empty()) {
        if let Ok(all) = fetch_statuses(clean_url.clone(), token.clone()).await {
            if !all.is_empty() {
                available_statuses = Some(all);
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
