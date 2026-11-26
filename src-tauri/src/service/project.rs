//! Projects, project versions and statuses.

use crate::model::project::{OpenProjectProjectItem, StatusOptionItem, VersionOptionItem};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_openproject_projects(
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

pub(crate) async fn fetch_project_versions(
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

pub(crate) async fn fetch_statuses(
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
