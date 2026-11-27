//! Full ticket context assembly: description, comments, attachments and allowed statuses.

use crate::model::project::StatusOptionItem;
use crate::model::ticket::{
    TicketActivityDetailItem, TicketAttachmentItem, TicketCommentItem, TicketContextResult,
    TicketDescriptionItem,
};
use crate::service::project::fetch_statuses;
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_ticket_context(
    url: String,
    token: String,
    ticket: String,
    include_description: Option<bool>,
    include_comments: Option<bool>,
    include_attachments: Option<bool>,
) -> Result<TicketContextResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    if raw_ticket.is_empty() {
        return Ok(TicketContextResult {
            success: false,
            ticket: ticket.clone(),
            subject: None,
            type_name: None,
            author_name: None,
            created_at: None,
            updated_at: None,
            description: None,
            comments: None,
            attachments: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            priority_name: None,
            assignee_name: None,
            responsible_name: None,
            start_date: None,
            due_date: None,
            estimated_time: None,
            spent_time: None,
            lock_version: None,
            available_statuses: None,
            message: "Ticket no especificado.".to_string(),
        });
    }

    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if !res.status().is_success() {
        return Ok(TicketContextResult {
            success: false,
            ticket: format!("#{}", raw_ticket),
            subject: None,
            type_name: None,
            author_name: None,
            created_at: None,
            updated_at: None,
            description: None,
            comments: None,
            attachments: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            priority_name: None,
            assignee_name: None,
            responsible_name: None,
            start_date: None,
            due_date: None,
            estimated_time: None,
            spent_time: None,
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

    let type_name = json_val["_links"]["type"]["title"]
        .as_str()
        .or_else(|| json_val["_embedded"]["type"]["title"].as_str())
        .map(|s| s.to_string());
    let author_name = json_val["_links"]["author"]["title"].as_str().map(|s| s.to_string());
    let created_at = json_val["createdAt"].as_str().map(|s| s.to_string());
    let updated_at = json_val["updatedAt"].as_str().map(|s| s.to_string());
    let priority_name = json_val["_links"]["priority"]["title"].as_str().map(|s| s.to_string());
    let assignee_name = json_val["_links"]["assignee"]["title"].as_str().map(|s| s.to_string());
    let responsible_name = json_val["_links"]["responsible"]["title"].as_str().map(|s| s.to_string());
    let start_date = json_val["startDate"].as_str().map(|s| s.to_string());
    let due_date = json_val["dueDate"].as_str().map(|s| s.to_string());
    let estimated_time = json_val["estimatedTime"].as_str().map(|s| s.to_string());
    let spent_time = json_val["spentTime"].as_str().map(|s| s.to_string());
    let lock_version = json_val["lockVersion"].as_i64();

    // 1. Description
    let description = if include_description.unwrap_or(true) {
        let desc_obj = &json_val["description"];
        if desc_obj.is_object() {
            Some(TicketDescriptionItem {
                raw: desc_obj["raw"].as_str().map(|s| s.to_string()),
                html: desc_obj["html"].as_str().map(|s| s.to_string()),
                format: desc_obj["format"].as_str().map(|s| s.to_string()),
            })
        } else {
            None
        }
    } else {
        None
    };

    // 2. Comments / Activities
    let comments = if include_comments.unwrap_or(false) {
        let act_endpoint = format!("{}/api/v3/work_packages/{}/activities", clean_url, raw_ticket);
        if let Ok(act_res) = client
            .get(&act_endpoint)
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
        {
            if act_res.status().is_success() {
                if let Ok(act_json) = act_res.json::<serde_json::Value>().await {
                    let elements = act_json["_embedded"]["elements"].as_array();
                    if let Some(arr) = elements {
                        // Pre-populate known users from work package fields
                        let mut known_users: std::collections::HashMap<String, String> = std::collections::HashMap::new();
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["author"]["href"].as_str(),
                            json_val["_links"]["author"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["assignee"]["href"].as_str(),
                            json_val["_links"]["assignee"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["responsible"]["href"].as_str(),
                            json_val["_links"]["responsible"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }

                        // Collect unique user IDs from activities that aren't known yet
                        let mut missing_uids = std::collections::HashSet::new();
                        for a in arr {
                            if let Some(href) = a["_links"]["user"]["href"].as_str() {
                                let uid = href.split('/').last().unwrap_or("");
                                if !uid.is_empty() && !known_users.contains_key(uid) {
                                    missing_uids.insert(uid.to_string());
                                }
                            }
                        }

                        // Fetch names for missing user IDs
                        for uid in missing_uids {
                            let user_endpoint = format!("{}/api/v3/users/{}", clean_url, uid);
                            if let Ok(u_res) = client
                                .get(&user_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Accept", "application/hal+json, application/json")
                                .send()
                                .await
                            {
                                if u_res.status().is_success() {
                                    if let Ok(u_json) = u_res.json::<serde_json::Value>().await {
                                        if let Some(name) = u_json["name"].as_str() {
                                            known_users.insert(uid.clone(), name.to_string());
                                        }
                                    }
                                }
                            }
                        }

                        let mut list = Vec::new();
                        for a in arr {
                            let comment_obj = &a["comment"];
                            let raw_c = comment_obj["raw"].as_str().unwrap_or("").trim();
                            let html_c = comment_obj["html"].as_str().unwrap_or("").trim();

                            let mut details_list = Vec::new();
                            if let Some(d_arr) = a["details"].as_array() {
                                for d in d_arr {
                                    let raw_d = d["raw"].as_str().unwrap_or("").trim();
                                    let html_d = d["html"].as_str().unwrap_or("").trim();
                                    if !raw_d.is_empty() || !html_d.is_empty() {
                                        details_list.push(TicketActivityDetailItem {
                                            raw: raw_d.to_string(),
                                            html: if html_d.is_empty() { raw_d.to_string() } else { html_d.to_string() },
                                        });
                                    }
                                }
                            }

                            // Keep activity if it has a note OR details
                            if !raw_c.is_empty() || !html_c.is_empty() || !details_list.is_empty() {
                                let id = a["id"].as_i64().map(|i| i.to_string()).unwrap_or_default();
                                let created_at = a["createdAt"].as_str().unwrap_or("").to_string();

                                let user_href = a["_links"]["user"]["href"].as_str().unwrap_or("");
                                let uid = user_href.split('/').last().unwrap_or("");
                                let user_name = if let Some(known) = known_users.get(uid) {
                                    known.clone()
                                } else if let Some(title) = a["_links"]["user"]["title"].as_str() {
                                    title.to_string()
                                } else if !uid.is_empty() {
                                    format!("Usuario #{}", uid)
                                } else {
                                    "Desconocido".to_string()
                                };

                                list.push(TicketCommentItem {
                                    id,
                                    comment_raw: raw_c.to_string(),
                                    comment_html: if html_c.is_empty() { raw_c.to_string() } else { html_c.to_string() },
                                    created_at,
                                    user_name,
                                    details: details_list,
                                });
                            }
                        }
                        Some(list)
                    } else {
                        Some(Vec::new())
                    }
                } else {
                    Some(Vec::new())
                }
            } else {
                Some(Vec::new())
            }
        } else {
            Some(Vec::new())
        }
    } else {
        None
    };

    // 3. Attachments
    let attachments = if include_attachments.unwrap_or(false) {
        let att_endpoint = format!("{}/api/v3/work_packages/{}/attachments", clean_url, raw_ticket);
        if let Ok(att_res) = client
            .get(&att_endpoint)
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
        {
            if att_res.status().is_success() {
                if let Ok(att_json) = att_res.json::<serde_json::Value>().await {
                    let elements = att_json["_embedded"]["elements"].as_array();
                    if let Some(arr) = elements {
                        let mut list = Vec::new();
                        for att in arr {
                            let id = att["id"].as_i64().map(|i| i.to_string()).unwrap_or_default();
                            let file_name = att["fileName"].as_str().unwrap_or("archivo").to_string();
                            let file_size = att["fileSize"].as_i64().unwrap_or(0);
                            let content_type = att["contentType"].as_str().unwrap_or("application/octet-stream").to_string();
                            let mut download_url = att["_links"]["downloadLocation"]["href"].as_str().unwrap_or("").to_string();
                            if download_url.is_empty() && !id.is_empty() {
                                download_url = format!("/api/v3/attachments/{}/content", id);
                            }
                            let is_image = content_type.starts_with("image/")
                                || file_name.ends_with(".png")
                                || file_name.ends_with(".jpg")
                                || file_name.ends_with(".jpeg")
                                || file_name.ends_with(".webp")
                                || file_name.ends_with(".gif");
                            let created_at = att["createdAt"].as_str().map(|s| s.to_string());
                            let author_name = att["_links"]["author"]["title"].as_str().map(|s| s.to_string());
                            list.push(TicketAttachmentItem {
                                id,
                                file_name,
                                file_size,
                                content_type,
                                download_url,
                                is_image,
                                created_at,
                                author_name,
                            });
                        }
                        Some(list)
                    } else {
                        Some(Vec::new())
                    }
                } else {
                    Some(Vec::new())
                }
            } else {
                Some(Vec::new())
            }
        } else {
            Some(Vec::new())
        }
    } else {
        None
    };

    // 4. Form endpoint for allowed statuses
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

    Ok(TicketContextResult {
        success: true,
        ticket: format!("#{}", raw_ticket),
        subject,
        type_name,
        author_name,
        created_at,
        updated_at,
        description,
        comments,
        attachments,
        project_id,
        project_name,
        status_id,
        status_name,
        status_color,
        version_id,
        version_name,
        priority_name,
        assignee_name,
        responsible_name,
        start_date,
        due_date,
        estimated_time,
        spent_time,
        lock_version,
        available_statuses,
        message: "Ticket cargado con éxito".to_string(),
    })
}
