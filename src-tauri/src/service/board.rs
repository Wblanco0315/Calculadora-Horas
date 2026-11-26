//! Project boards and board columns (queries with their work package cards).

use crate::model::board::{BoardColumnOptionItem, BoardOptionItem, BoardWorkPackageCardItem};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_project_boards(
    url: String,
    token: String,
    project_id: String,
    project_identifier: Option<String>,
) -> Result<Vec<BoardOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/grids", clean_url);
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
        for g in elements {
            let scope = g["_links"]["scope"]["href"]
                .as_str()
                .or_else(|| g["_links"]["page"]["href"].as_str())
                .unwrap_or("");

            let is_board = scope.ends_with("/boards")
                || g["widgets"].as_array().map_or(false, |w| {
                    w.iter()
                        .any(|item| item["identifier"].as_str() == Some("work_package_query"))
                });

            // Exclude non-workflow grids like subtask hierarchy views (WBS)
            let is_subtask_view = g["options"]["attribute"].as_str() == Some("subtasks");
            if !is_board || is_subtask_view {
                continue;
            }

            let proj_href = g["_links"]["project"]["href"].as_str().unwrap_or("");
            let proj_id = proj_href.split('/').last().unwrap_or("");

            let pid = project_id.trim();
            let matches_project = (proj_id == pid || proj_href.ends_with(&format!("/{}", pid)))
                || scope.contains(&format!("/{}/", pid))
                || project_identifier.as_ref().map_or(false, |ident| {
                    !ident.is_empty() && scope.contains(&format!("/{}/", ident))
                });

            if matches_project {
                let id = g["id"].as_i64().map(|n| n.to_string()).unwrap_or_default();
                let name = g["name"]
                    .as_str()
                    .or_else(|| g["_links"]["scope"]["title"].as_str())
                    .or_else(|| g["_links"]["page"]["title"].as_str())
                    .unwrap_or("Board")
                    .to_string();

                list.push(BoardOptionItem {
                    id,
                    name,
                    kind: g["options"]["type"].as_str().map(str::to_string),
                    attribute: g["options"]["attribute"].as_str().map(str::to_string),
                    created_at: g["createdAt"].as_str().map(str::to_string),
                });
            }
        }
    }

    Ok(list)
}

pub(crate) async fn fetch_board_columns(
    url: String,
    token: String,
    grid_id: String,
) -> Result<Vec<BoardColumnOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/grids/{}", clean_url, grid_id.trim());
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let grid_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut columns = Vec::new();

    if let Some(widgets) = grid_val["widgets"].as_array() {
        for widget in widgets {
            let widget_id = widget["id"].as_i64().unwrap_or(0);
            let start_column = widget["startColumn"].as_i64().unwrap_or(0);
            let query_id = widget["options"]["queryId"]
                .as_i64()
                .map(|n| n.to_string())
                .or_else(|| {
                    widget["options"]["queryId"]
                        .as_str()
                        .map(|s| s.to_string())
                });

            if let Some(qid) = query_id {
                let q_endpoint = format!("{}/api/v3/queries/{}", clean_url, qid);
                if let Ok(q_res) = client
                    .get(&q_endpoint)
                    .header("Authorization", &auth_value)
                    .header("Accept", "application/hal+json, application/json")
                    .send()
                    .await
                {
                    if q_res.status().is_success() {
                        if let Ok(q_val) = q_res.json::<serde_json::Value>().await {
                            let name = q_val["name"]
                                .as_str()
                                .unwrap_or(&format!("Columna {}", qid))
                                .to_string();

                            let mut wp_ids = Vec::new();
                            let mut wp_cards = Vec::new();
                            if let Some(elements) = q_val["_embedded"]["results"]["_embedded"]
                                ["elements"]
                                .as_array()
                            {
                                for el in elements {
                                    if let Some(id) = el["id"].as_i64() {
                                        wp_ids.push(id);
                                        let subject = el["subject"]
                                            .as_str()
                                            .unwrap_or("")
                                            .to_string();
                                        let type_name = el["_links"]["type"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let type_color = el["_embedded"]["type"]["color"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let wp_status_id = el["_links"]["status"]["href"]
                                            .as_str()
                                            .and_then(|h| h.split('/').last())
                                            .map(|s| s.to_string());
                                        let wp_status_name = el["_links"]["status"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let wp_status_color = el["_embedded"]["status"]["color"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let priority_name = el["_links"]["priority"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let assignee_name = el["_links"]["assignee"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let project_name = el["_links"]["project"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let start_date = el["startDate"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let due_date = el["dueDate"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let lock_version = el["lockVersion"].as_i64();

                                        wp_cards.push(BoardWorkPackageCardItem {
                                            id,
                                            subject,
                                            type_name,
                                            type_color,
                                            status_id: wp_status_id,
                                            status_name: wp_status_name,
                                            status_color: wp_status_color,
                                            priority_name,
                                            assignee_name,
                                            project_name,
                                            start_date,
                                            due_date,
                                            lock_version,
                                        });
                                    }
                                }
                            }

                            let mut status_id = None;
                            let mut status_name = None;
                            if let Some(filters) = q_val["filters"].as_array() {
                                for f in filters {
                                    let href =
                                        f["_links"]["filter"]["href"].as_str().unwrap_or("");
                                    let fname = f["name"].as_str().unwrap_or("").to_lowercase();
                                    if href.ends_with("/status")
                                        || href.ends_with("/status_id")
                                        || fname == "status"
                                        || fname == "estado"
                                    {
                                        if let Some(val_obj) = f["_links"]["values"]
                                            .as_array()
                                            .and_then(|v| v.first())
                                        {
                                            if let Some(v_href) = val_obj["href"].as_str() {
                                                status_id = v_href
                                                    .split('/')
                                                    .last()
                                                    .map(|s| s.to_string());
                                                status_name = val_obj["title"]
                                                    .as_str()
                                                    .map(|s| s.to_string());
                                            }
                                        } else if let Some(first_val) =
                                            f["values"].as_array().and_then(|v| v.first())
                                        {
                                            status_id = first_val
                                                .as_str()
                                                .map(|s| s.to_string())
                                                .or_else(|| first_val.as_i64().map(|n| n.to_string()));
                                        }
                                        break;
                                    }
                                }
                            }

                            columns.push(BoardColumnOptionItem {
                                query_id: qid,
                                name,
                                widget_id,
                                start_column,
                                work_package_ids: wp_ids,
                                work_packages: wp_cards,
                                status_id,
                                status_name,
                            });
                        }
                    }
                }
            }
        }
    }

    columns.sort_by_key(|c| c.start_column);
    Ok(columns)
}
