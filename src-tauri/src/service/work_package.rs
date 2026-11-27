//! Work package status/version updates, search, revisions, update stream and costs.

use crate::model::work_package::{
    WorkPackageCostSummaryItem, WorkPackageRevisionItem, WorkPackageSearchItem,
    WorkPackageUpdateStreamResult,
};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn update_work_package_status(
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
                .header("Accept", "application/hal+json, application/json")
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
        .header("Accept", "application/hal+json, application/json")
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

pub(crate) async fn update_work_package_version(
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
                .header("Accept", "application/hal+json, application/json")
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
        .header("Accept", "application/hal+json, application/json")
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

/// Searches work packages by subject or ID with OpenProject's `typeahead` filter (most recently updated first).
pub(crate) async fn search_work_packages(
    url: String,
    token: String,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<WorkPackageSearchItem>, String> {
    let query = query.trim().trim_start_matches('#').to_string();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/work_packages", clean_url);
    let filters = serde_json::json!([{
        "typeahead": { "operator": "**", "values": [query] }
    }])
    .to_string();
    let sort_by = serde_json::json!([["updatedAt", "desc"]]).to_string();
    let page_size = limit.unwrap_or(8).clamp(1, 25).to_string();
    let client = build_http_client(12)?;
    let response = client
        .get(&endpoint)
        .query(&[
            ("filters", filters.as_str()),
            ("sortBy", sort_by.as_str()),
            ("pageSize", page_size.as_str()),
        ])
        .header("Authorization", build_auth_header(&token))
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(data["_embedded"]["elements"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|work_package| {
            let links = &work_package["_links"];
            Some(WorkPackageSearchItem {
                id: work_package["id"].as_i64()?,
                subject: work_package["subject"].as_str().unwrap_or_default().to_string(),
                project_id: links["project"]["href"]
                    .as_str()
                    .and_then(|href| href.split('/').last())
                    .map(str::to_string),
                project_name: links["project"]["title"].as_str().map(str::to_string),
                type_name: links["type"]["title"].as_str().map(str::to_string),
                status_name: links["status"]["title"].as_str().map(str::to_string),
            })
        })
        .collect())
}

pub(crate) async fn fetch_work_package_revisions(
    url: String,
    token: String,
    ticket_ids: Vec<String>,
) -> Result<Vec<WorkPackageRevisionItem>, String> {
    let clean_url = sanitize_url(&url);
    let ticket_ids: Vec<String> = ticket_ids
        .into_iter()
        .map(|ticket| ticket.trim().trim_start_matches('#').to_string())
        .filter(|ticket| !ticket.is_empty() && ticket.chars().all(|character| character.is_ascii_digit()))
        .collect();
    if ticket_ids.is_empty() {
        return Ok(Vec::new());
    }

    let endpoint = format!("{}/api/v3/work_packages", clean_url);
    let page_size = ticket_ids.len().to_string();
    let filters = serde_json::json!([{
        "id": { "operator": "=", "values": ticket_ids }
    }])
    .to_string();
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let response = client
        .get(&endpoint)
        .query(&[
            ("filters", filters.as_str()),
            ("offset", "1"),
            ("pageSize", page_size.as_str()),
            ("valid_subset", "true"),
        ])
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(data["_embedded"]["elements"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|work_package| {
            let id = work_package["id"]
                .as_i64()
                .map(|id| id.to_string())
                .or_else(|| work_package["id"].as_str().map(|id| id.to_string()))?;
            let lock_version = work_package["lockVersion"].as_i64()?;
            Some(WorkPackageRevisionItem {
                id,
                lock_version,
                updated_at: work_package["updatedAt"].as_str().map(|value| value.to_string()),
            })
        })
        .collect())
}

pub(crate) async fn fetch_work_package_update_stream(
    url: String,
    token: String,
    ticket: String,
    last_update_timestamp: String,
) -> Result<WorkPackageUpdateStreamResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!(
        "{}/work_packages/{}/activities/update_streams",
        clean_url, raw_ticket
    );
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let response = match client
        .get(&endpoint)
        .query(&[
            ("sortBy", "asc"),
            ("filter", "all"),
            ("last_update_timestamp", last_update_timestamp.as_str()),
        ])
        .header("Authorization", &auth_value)
        .header("Accept", "text/vnd.turbo-stream.html, */*")
        .header("X-Requested-With", "XMLHttpRequest")
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => {
            return Ok(WorkPackageUpdateStreamResult {
                available: false,
                has_updates: false,
            });
        }
    };

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = response.text().await.unwrap_or_default();
    let available = content_type.contains("turbo-stream") || body.contains("<turbo-stream");

    Ok(WorkPackageUpdateStreamResult {
        available,
        has_updates: available && body.contains("<turbo-stream"),
    })
}

pub(crate) async fn fetch_work_package_cost_summary(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageCostSummaryItem, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let response = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Ok(WorkPackageCostSummaryItem::default());
    }
    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(WorkPackageCostSummaryItem {
        labor_costs: data["laborCosts"].as_str().map(|value| value.to_string()),
        material_costs: data["materialCosts"].as_str().map(|value| value.to_string()),
        overall_costs: data["overallCosts"].as_str().map(|value| value.to_string()),
    })
}
