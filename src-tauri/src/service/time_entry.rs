//! Time entry activities discovery, creation and update.

use crate::model::time_entry::{TimeEntryActivityItem, UpdateTimeEntryPayload};
use crate::openproject::schema::parse_activity_schema;
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_time_entry_activities(
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

pub(crate) async fn create_time_entry(
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

pub(crate) async fn update_work_package_time_entry(
    url: String,
    token: String,
    entry_id: String,
    payload: UpdateTimeEntryPayload,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_entry_id = entry_id.trim();
    let endpoint = format!("{}/api/v3/time_entries/{}", clean_url, raw_entry_id);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;
    let mut body = serde_json::json!({
        "hours": payload.hours,
        "spentOn": payload.spent_on,
        "comment": { "format": "plain", "raw": payload.comment }
    });
    if let Some(activity_id) = payload.activity_id {
        body["_links"]["activity"] =
            serde_json::json!({ "href": format!("/api/v3/time_entries/activities/{}", activity_id) });
    }
    let response = client
        .patch(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let message = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, message));
    }
    Ok(())
}
