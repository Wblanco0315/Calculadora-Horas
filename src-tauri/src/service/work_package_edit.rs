//! Work package edit form schema, field updates and comments.

use crate::model::work_package::{UpdateWorkPackagePayload, WorkPackageFormSchemaResult};
use crate::openproject::schema::{fetch_available_people, fetch_schema_allowed_values};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_work_package_form(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageFormSchemaResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}/form", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let mut assignees =
        fetch_available_people(&client, &clean_url, &auth_value, raw_ticket, "assignees").await;
    let mut responsibles =
        fetch_available_people(&client, &clean_url, &auth_value, raw_ticket, "responsibles").await;

    let form_val: serde_json::Value = match client
        .post(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            response.json().await.unwrap_or(serde_json::Value::Null)
        }
        _ => serde_json::Value::Null,
    };
    let schema = &form_val["_embedded"]["schema"];

    if assignees.is_empty() {
        assignees = fetch_schema_allowed_values(
            &schema["assignee"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await;
    }
    if responsibles.is_empty() {
        responsibles = fetch_schema_allowed_values(
            &schema["responsible"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await;
    }
    if responsibles.is_empty() {
        responsibles = assignees.clone();
    }

    Ok(WorkPackageFormSchemaResult {
        statuses: fetch_schema_allowed_values(&schema["status"], &client, &clean_url, &auth_value)
            .await,
        priorities: fetch_schema_allowed_values(
            &schema["priority"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await,
        assignees,
        responsibles,
        versions: fetch_schema_allowed_values(&schema["version"], &client, &clean_url, &auth_value)
            .await,
    })
}

pub(crate) async fn update_work_package(
    url: String,
    token: String,
    ticket: String,
    payload: UpdateWorkPackagePayload,
) -> Result<i64, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let wp_endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let lock_version = match payload.lock_version {
        Some(lv) => lv,
        None => {
            let wp_res = client
                .get(&wp_endpoint)
                .header("Authorization", &auth_value)
                .header("Accept", "application/hal+json, application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !wp_res.status().is_success() {
                return Err(format!("HTTP {}", wp_res.status()));
            }
            let wp_val: serde_json::Value = wp_res.json().await.map_err(|e| e.to_string())?;
            wp_val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let mut body = serde_json::Map::new();
    body.insert("lockVersion".to_string(), serde_json::json!(lock_version));

    if let Some(subject) = payload.subject {
        body.insert("subject".to_string(), serde_json::json!(subject));
    }
    if let Some(desc) = payload.description_raw {
        body.insert(
            "description".to_string(),
            serde_json::json!({ "format": "markdown", "raw": desc }),
        );
    }
    if payload.clear_start_date.unwrap_or(false) {
        body.insert("startDate".to_string(), serde_json::Value::Null);
    } else if let Some(sd) = payload.start_date {
        body.insert("startDate".to_string(), serde_json::json!(sd));
    }
    if payload.clear_due_date.unwrap_or(false) {
        body.insert("dueDate".to_string(), serde_json::Value::Null);
    } else if let Some(dd) = payload.due_date {
        body.insert("dueDate".to_string(), serde_json::json!(dd));
    }
    if let Some(est) = payload.estimated_time {
        body.insert("estimatedTime".to_string(), serde_json::json!(est));
    }

    let mut links = serde_json::Map::new();
    if let Some(sid) = payload.status_id {
        links.insert("status".to_string(), serde_json::json!({ "href": format!("/api/v3/statuses/{}", sid) }));
    }
    if let Some(pid) = payload.priority_id {
        links.insert("priority".to_string(), serde_json::json!({ "href": format!("/api/v3/priorities/{}", pid) }));
    }
    if payload.clear_assignee.unwrap_or(false) {
        links.insert("assignee".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(aid) = payload.assignee_id {
        links.insert("assignee".to_string(), serde_json::json!({ "href": format!("/api/v3/users/{}", aid) }));
    }
    if payload.clear_responsible.unwrap_or(false) {
        links.insert("responsible".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(rid) = payload.responsible_id {
        links.insert("responsible".to_string(), serde_json::json!({ "href": format!("/api/v3/users/{}", rid) }));
    }
    if payload.clear_version.unwrap_or(false) {
        links.insert("version".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(vid) = payload.version_id {
        links.insert("version".to_string(), serde_json::json!({ "href": format!("/api/v3/versions/{}", vid) }));
    }

    if !links.is_empty() {
        body.insert("_links".to_string(), serde_json::Value::Object(links));
    }

    let patch_res = client
        .patch(&wp_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::Value::Object(body))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !patch_res.status().is_success() {
        let status = patch_res.status();
        let err_text = patch_res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, err_text));
    }

    let updated: serde_json::Value = patch_res.json().await.map_err(|e| e.to_string())?;
    Ok(updated["lockVersion"].as_i64().unwrap_or(lock_version + 1))
}

pub(crate) async fn add_work_package_comment(
    url: String,
    token: String,
    ticket: String,
    comment: String,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}/activities", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let res = client
        .post(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "comment": {
                "format": "markdown",
                "raw": comment
            }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, err_text));
    }

    Ok(())
}
