//! Moving a work package between board columns and persisting its position.

use crate::model::board::MoveColumnResult;
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) fn build_query_order_delta(
    ticket_id: i64,
    order_map: &serde_json::Map<String, serde_json::Value>,
    target_position_index: Option<usize>,
    target_ticket_ids: Option<&[i64]>,
) -> serde_json::Map<String, serde_json::Value> {
    const ORDER_GAP: i64 = 8192;

    let mut ordered_entries: Vec<(i64, i64)> = order_map
        .iter()
        .filter_map(|(id, position)| {
            let id = id.parse::<i64>().ok()?;
            let position = position.as_i64()?;
            (id != ticket_id).then_some((id, position))
        })
        .collect();
    ordered_entries.sort_by_key(|(id, position)| (*position, *id));

    let Some(target_position_index) = target_position_index else {
        let position = ordered_entries
            .iter()
            .map(|(_, position)| *position)
            .min()
            .map(|position| position.saturating_sub(ORDER_GAP))
            .unwrap_or(0);
        return serde_json::Map::from_iter([(
            ticket_id.to_string(),
            serde_json::Value::from(position),
        )]);
    };

    let mut target_ids = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    for id in target_ticket_ids.unwrap_or_default() {
        if *id > 0 && *id != ticket_id && seen_ids.insert(*id) {
            target_ids.push(*id);
        }
    }
    let target_index = target_position_index.min(target_ids.len());
    let previous_id = target_index.checked_sub(1).and_then(|index| target_ids.get(index));
    let next_id = target_ids.get(target_index);
    let mut ordered_ids: Vec<i64> = ordered_entries.iter().map(|(id, _)| *id).collect();

    for (index, id) in target_ids.iter().enumerate() {
        if ordered_ids.contains(id) {
            continue;
        }
        let next_known_index = target_ids[index + 1..]
            .iter()
            .find_map(|candidate| ordered_ids.iter().position(|ordered_id| ordered_id == candidate));
        if let Some(position) = next_known_index {
            ordered_ids.insert(position, *id);
            continue;
        }
        let previous_known_index = target_ids[..index]
            .iter()
            .rev()
            .find_map(|candidate| ordered_ids.iter().position(|ordered_id| ordered_id == candidate));
        if let Some(position) = previous_known_index {
            ordered_ids.insert(position + 1, *id);
            continue;
        }
        ordered_ids.insert(index.min(ordered_ids.len()), *id);
    }

    let next_index = next_id.and_then(|id| ordered_ids.iter().position(|ordered_id| ordered_id == id));
    let previous_index = previous_id.and_then(|id| ordered_ids.iter().position(|ordered_id| ordered_id == id));
    let insertion_index = next_index
        .or_else(|| previous_index.map(|index| index + 1))
        .unwrap_or_else(|| target_index.min(ordered_ids.len()));

    let position_for = |id: Option<&i64>| {
        id.and_then(|id| ordered_entries.iter().find(|(ordered_id, _)| ordered_id == id))
            .map(|(_, position)| *position)
    };
    let previous_position = insertion_index
        .checked_sub(1)
        .and_then(|index| ordered_ids.get(index))
        .and_then(|id| position_for(Some(id)));
    let next_position = ordered_ids
        .get(insertion_index)
        .and_then(|id| position_for(Some(id)));

    if let (Some(previous), Some(next)) = (previous_position, next_position) {
        if next.saturating_sub(previous) > 1 {
            let position = previous.saturating_add(next.saturating_sub(previous) / 2);
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(position),
            )]);
        }
    } else if let Some(previous) = previous_position {
        if insertion_index == ordered_ids.len() {
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(previous.saturating_add(ORDER_GAP)),
            )]);
        }
    } else if let Some(next) = next_position {
        if insertion_index == 0 {
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(next.saturating_sub(ORDER_GAP)),
            )]);
        }
    } else if ordered_ids.is_empty() {
        return serde_json::Map::from_iter([(
            ticket_id.to_string(),
            serde_json::Value::from(0),
        )]);
    }

    ordered_ids.insert(insertion_index, ticket_id);
    serde_json::Map::from_iter(ordered_ids.iter().enumerate().map(|(index, id)| {
        (
            id.to_string(),
            serde_json::Value::from((index as i64).saturating_mul(ORDER_GAP)),
        )
    }))
}

pub(crate) async fn move_work_package_to_board_column(
    url: String,
    token: String,
    ticket: String,
    target_query_id: String,
    source_query_id: Option<String>,
    target_status_id: Option<String>,
    target_position_index: Option<usize>,
    target_ticket_ids: Option<Vec<i64>>,
    expected_lock_version: Option<i64>,
) -> Result<MoveColumnResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let same_query = source_query_id.as_deref() == Some(target_query_id.as_str());
    let ticket_num = raw_ticket
        .parse::<i64>()
        .map_err(|_| "Ticket ID inválido".to_string())?;
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let snapshot_response = client
        .get(&wp_url)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !snapshot_response.status().is_success() {
        return Ok(MoveColumnResult {
            ok: false,
            status_id: None,
            error: Some(format!("No se pudo validar el ticket (HTTP {})", snapshot_response.status())),
        });
    }
    let snapshot: serde_json::Value = snapshot_response.json().await.map_err(|error| error.to_string())?;
    let current_lock_version = snapshot["lockVersion"].as_i64().unwrap_or(0);
    if expected_lock_version.is_some_and(|expected| expected != current_lock_version) {
        return Ok(MoveColumnResult {
            ok: false,
            status_id: None,
            error: Some(format!(
                "WORK_PACKAGE_CONFLICT: el ticket cambió en OpenProject (versión actual {}). Recarga antes de moverlo.",
                current_lock_version
            )),
        });
    }

    // 1. Determine target status
    let mut resolved_status_id = target_status_id;
    if resolved_status_id.is_none() {
        let q_url = format!("{}/api/v3/queries/{}", clean_url, target_query_id);
        if let Ok(res) = client
            .get(&q_url)
            .header("Authorization", &auth_value)
            .send()
            .await
        {
            if let Ok(q_val) = res.json::<serde_json::Value>().await {
                if let Some(filters) = q_val["filters"].as_array() {
                    for f in filters {
                        let href = f["_links"]["filter"]["href"].as_str().unwrap_or("");
                        let fname = f["name"].as_str().unwrap_or("").to_lowercase();
                        if href.ends_with("/status")
                            || href.ends_with("/status_id")
                            || fname == "status"
                            || fname == "estado"
                        {
                            if let Some(val_obj) =
                                f["_links"]["values"].as_array().and_then(|v| v.first())
                            {
                                resolved_status_id = val_obj["href"]
                                    .as_str()
                                    .and_then(|h| h.split('/').last())
                                    .map(|s| s.to_string());
                            } else if let Some(fv) = f["values"].as_array().and_then(|v| v.first())
                            {
                                resolved_status_id = fv
                                    .as_str()
                                    .map(|s| s.to_string())
                                    .or_else(|| fv.as_i64().map(|n| n.to_string()));
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 2. Update Work Package status only when the drop changes columns
    let mut status_was_updated = false;
    if !same_query {
        if let Some(ref sid) = resolved_status_id {
            let patch_body = serde_json::json!({
                "lockVersion": current_lock_version,
                "_links": {
                    "status": { "href": format!("/api/v3/statuses/{}", sid) }
                }
            });
            let status_res = client
                .patch(&wp_url)
                .header("Authorization", &auth_value)
                .header("Content-Type", "application/json")
                .json(&patch_body)
                .send()
                .await
                .map_err(|e| format!("Error actualizando estado: {}", e))?;

            if !status_res.status().is_success() {
                let error = status_res.text().await.unwrap_or_default();
                return Ok(MoveColumnResult {
                    ok: false,
                    status_id: resolved_status_id.clone(),
                    error: Some(format!("Error actualizando estado en OpenProject: {}", error)),
                });
            }
            status_was_updated = true;
        }
    }

    // 3. Remove from source query order if different
    if let Some(ref sqid) = source_query_id {
        if sqid != &target_query_id && !sqid.is_empty() {
            let src_order_url = format!("{}/api/v3/queries/{}/order", clean_url, sqid);
            let remove_body = serde_json::json!({
                "delta": { ticket_num.to_string(): -1 }
            });
            let _ = client
                .patch(&src_order_url)
                .header("Authorization", &auth_value)
                .header("Content-Type", "application/json")
                .json(&remove_body)
                .send()
                .await;
        }
    }

    // 4. Persist the requested visual position. Calls without a drop index retain first-position behavior.
    let target_order_url = format!("{}/api/v3/queries/{}/order", clean_url, target_query_id);
    let mut order_map = serde_json::Map::new();
    let order_response = client
        .get(&target_order_url)
        .header("Authorization", &auth_value)
        .header("Accept", "application/json")
        .send()
        .await;

    match order_response {
        Ok(response) if response.status().is_success() => {
            match response.json::<serde_json::Map<String, serde_json::Value>>().await {
                Ok(map) => order_map = map,
                Err(error) if target_position_index.is_some() => {
                    return Ok(MoveColumnResult {
                        ok: false,
                        status_id: resolved_status_id,
                        error: Some(format!("Error leyendo el orden de la columna: {}", error)),
                    });
                }
                Err(_) => {}
            }
        }
        Ok(response) if target_position_index.is_some() => {
            let error = response.text().await.unwrap_or_default();
            return Ok(MoveColumnResult {
                ok: false,
                status_id: resolved_status_id,
                error: Some(format!("Error leyendo el orden de la columna: {}", error)),
            });
        }
        Err(error) if target_position_index.is_some() => {
            return Ok(MoveColumnResult {
                ok: false,
                status_id: resolved_status_id,
                error: Some(format!("Error leyendo el orden de la columna: {}", error)),
            });
        }
        _ => {}
    }

    let order_delta = build_query_order_delta(
        ticket_num,
        &order_map,
        target_position_index,
        target_ticket_ids.as_deref(),
    );
    let target_body = serde_json::json!({ "delta": order_delta });
    let target_res = client
        .patch(&target_order_url)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .json(&target_body)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if target_res.status().is_success() {
        Ok(MoveColumnResult {
            ok: true,
            status_id: resolved_status_id,
            error: None,
        })
    } else if status_was_updated {
        Ok(MoveColumnResult {
            ok: true,
            status_id: resolved_status_id,
            error: None,
        })
    } else {
        let err_text = target_res.text().await.unwrap_or_default();
        Ok(MoveColumnResult {
            ok: false,
            status_id: resolved_status_id,
            error: Some(format!("Error en OpenProject: {}", err_text)),
        })
    }
}
