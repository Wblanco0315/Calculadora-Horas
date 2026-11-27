//! Work packages of the connected OpenProject user (assignee and/or responsible), filtered by
//! status and project and grouped project by project.

use std::collections::BTreeMap;

use crate::model::work_package::{
    MyTicketFilter, MyTicketItem, MyTicketProjectGroup, MyTicketResult, MyTicketStatusCount,
};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;
use crate::service::project;

const PAGE_SIZE: usize = 100;
/// Upper bound of tickets returned in one call (keeps the AI answer readable).
const MAX_TICKETS: usize = 500;
const NO_PROJECT: &str = "Sin proyecto";

type ProjectRef = (Option<String>, String);

pub(crate) async fn fetch_my_tickets(
    url: String,
    token: String,
    filter: MyTicketFilter,
) -> Result<MyTicketResult, String> {
    let role = match filter.role.as_deref().map(str::trim).unwrap_or("assignee") {
        "" | "assignee" => "assignee",
        "responsible" => "responsible",
        "any" => "any",
        other => {
            return Err(format!(
                "Rol inválido '{}': usa assignee, responsible o any.",
                other
            ))
        }
    };
    let project_id = filter
        .project_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .map(str::to_string);
    if let Some(id) = &project_id {
        if !id.chars().all(|c| c.is_ascii_digit()) {
            return Err(format!(
                "project_id inválido '{}': usa el ID numérico de get_projects.",
                id
            ));
        }
    }

    // Status filter: names or IDs -> IDs; none -> open (or every) status.
    let mut unknown_statuses = Vec::new();
    let requested: Vec<&str> = filter
        .statuses
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    let (status_filter, status_labels) = if requested.is_empty() {
        let (operator, label) = if filter.include_closed {
            ("*", "all")
        } else {
            ("o", "open")
        };
        (
            serde_json::json!({ "operator": operator, "values": [] }),
            vec![label.to_string()],
        )
    } else {
        let known = project::fetch_statuses(url.clone(), token.clone()).await?;
        let mut ids: Vec<String> = Vec::new();
        let mut names = Vec::new();
        for wanted in requested {
            let needle = normalize(wanted);
            let found = known
                .iter()
                .find(|s| s.id == wanted || normalize(&s.name) == needle)
                .or_else(|| known.iter().find(|s| normalize(&s.name).contains(&needle)));
            match found {
                Some(status) if !ids.contains(&status.id) => {
                    ids.push(status.id.clone());
                    names.push(status.name.clone());
                }
                Some(_) => {}
                None => unknown_statuses.push(wanted.to_string()),
            }
        }
        if ids.is_empty() {
            let available: Vec<&str> = known.iter().map(|s| s.name.as_str()).collect();
            return Err(format!(
                "Ningún estado coincide con {:?}. Estados disponibles: {}.",
                filter.statuses,
                available.join(", ")
            ));
        }
        (serde_json::json!({ "operator": "=", "values": ids }), names)
    };

    let roles: &[&str] = match role {
        "any" => &["assignee", "responsible"],
        "responsible" => &["responsible"],
        _ => &["assignee"],
    };
    let mut tickets: Vec<(MyTicketItem, ProjectRef)> = Vec::new();
    let mut truncated = false;
    for role_filter in roles {
        let mut filters = vec![
            serde_json::json!({ *role_filter: { "operator": "=", "values": ["me"] } }),
            serde_json::json!({ "status": status_filter }),
        ];
        if let Some(id) = &project_id {
            filters.push(serde_json::json!({ "project": { "operator": "=", "values": [id] } }));
        }
        let (items, more) = fetch_pages(&url, &token, &serde_json::Value::Array(filters)).await?;
        truncated |= more;
        for entry in items {
            if tickets.len() >= MAX_TICKETS {
                truncated = true;
                break;
            }
            if !tickets.iter().any(|(t, _)| t.id == entry.0.id) {
                tickets.push(entry);
            }
        }
    }

    let projects = group_by_project(tickets);
    let total = projects.iter().map(|g| g.total).sum();
    Ok(MyTicketResult {
        role: role.to_string(),
        statuses: status_labels,
        unknown_statuses,
        project_id,
        total,
        truncated,
        projects,
    })
}

/// Project by project (sorted by name); inside each, by status and then most recently updated.
fn group_by_project(tickets: Vec<(MyTicketItem, ProjectRef)>) -> Vec<MyTicketProjectGroup> {
    let mut groups: BTreeMap<String, MyTicketProjectGroup> = BTreeMap::new();
    for (ticket, (project_id, project_name)) in tickets {
        let group =
            groups
                .entry(normalize(&project_name))
                .or_insert_with(|| MyTicketProjectGroup {
                    project_id,
                    project_name,
                    total: 0,
                    by_status: Vec::new(),
                    tickets: Vec::new(),
                });
        group.total += 1;
        group.tickets.push(ticket);
    }
    let mut projects: Vec<MyTicketProjectGroup> = groups.into_values().collect();
    for group in &mut projects {
        group.tickets.sort_by(|a, b| {
            a.status_name
                .cmp(&b.status_name)
                .then(b.updated_at.cmp(&a.updated_at))
        });
        let mut counts: BTreeMap<String, usize> = BTreeMap::new();
        for ticket in &group.tickets {
            *counts
                .entry(ticket.status_name.clone().unwrap_or_default())
                .or_default() += 1;
        }
        group.by_status = counts
            .into_iter()
            .map(|(status, count)| MyTicketStatusCount { status, count })
            .collect();
    }
    projects
}

/// Reads every page of the query (up to `MAX_TICKETS`); returns the items and whether more exist.
async fn fetch_pages(
    url: &str,
    token: &str,
    filters: &serde_json::Value,
) -> Result<(Vec<(MyTicketItem, ProjectRef)>, bool), String> {
    let endpoint = format!("{}/api/v3/work_packages", sanitize_url(url));
    let filters = filters.to_string();
    let sort_by = serde_json::json!([["updatedAt", "desc"]]).to_string();
    let page_size = PAGE_SIZE.to_string();
    let auth_value = build_auth_header(token);
    let client = build_http_client(20)?;

    let mut items = Vec::new();
    let mut offset = 1;
    loop {
        let offset_value = offset.to_string();
        let response = client
            .get(&endpoint)
            .query(&[
                ("filters", filters.as_str()),
                ("sortBy", sort_by.as_str()),
                ("pageSize", page_size.as_str()),
                ("offset", offset_value.as_str()),
            ])
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("OpenProject respondió HTTP {}", response.status()));
        }
        let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
        let elements = data["_embedded"]["elements"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        items.extend(elements.iter().filter_map(parse_item));
        let total = data["total"].as_u64().unwrap_or(0) as usize;
        if items.len() >= MAX_TICKETS {
            return Ok((items, total > MAX_TICKETS));
        }
        if elements.len() < PAGE_SIZE || offset * PAGE_SIZE >= total {
            return Ok((items, false));
        }
        offset += 1;
    }
}

fn parse_item(work_package: &serde_json::Value) -> Option<(MyTicketItem, ProjectRef)> {
    let links = &work_package["_links"];
    let title = |key: &str| links[key]["title"].as_str().map(str::to_string);
    let last_segment = |key: &str| {
        links[key]["href"]
            .as_str()
            .and_then(|href| href.split('/').last())
            .map(str::to_string)
    };
    let item = MyTicketItem {
        id: work_package["id"].as_i64()?,
        subject: work_package["subject"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        type_name: title("type"),
        status_id: last_segment("status"),
        status_name: title("status"),
        priority_name: title("priority"),
        assignee_name: title("assignee"),
        responsible_name: title("responsible"),
        version_name: title("version"),
        due_date: work_package["dueDate"].as_str().map(str::to_string),
        updated_at: work_package["updatedAt"].as_str().map(str::to_string),
        lock_version: work_package["lockVersion"].as_i64(),
    };
    let project_name = title("project").unwrap_or_else(|| NO_PROJECT.to_string());
    Some((item, (last_segment("project"), project_name)))
}

/// Lowercase without accents, so "Desarrollado" matches "desarrollado" and "En revisión" "en revision".
fn normalize(text: &str) -> String {
    text.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'ä' => 'a',
            'é' | 'è' | 'ë' => 'e',
            'í' | 'ì' | 'ï' => 'i',
            'ó' | 'ò' | 'ö' => 'o',
            'ú' | 'ù' | 'ü' => 'u',
            other => other,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn work_package(id: i64, status: &str, project: &str) -> serde_json::Value {
        serde_json::json!({
            "id": id, "subject": format!("Ticket {}", id), "lockVersion": 3,
            "updatedAt": format!("2026-11-{:02}T10:00:00Z", id),
            "_links": {
                "status": { "href": "/api/v3/statuses/7", "title": status },
                "project": { "href": "/api/v3/projects/5", "title": project }
            }
        })
    }

    #[test]
    fn normalizes_status_names() {
        assert_eq!(normalize(" En Revisión "), "en revision");
        assert_eq!(normalize("DESARROLLADO"), "desarrollado");
    }

    #[test]
    fn parses_a_work_package() {
        let (item, (project_id, project_name)) =
            parse_item(&work_package(42, "Desarrollado", "Pagos")).unwrap();
        assert_eq!(item.id, 42);
        assert_eq!(item.status_id.as_deref(), Some("7"));
        assert_eq!(item.lock_version, Some(3));
        assert_eq!(
            (project_id.as_deref(), project_name.as_str()),
            (Some("5"), "Pagos")
        );
    }

    #[test]
    fn groups_tickets_project_by_project() {
        let tickets = [
            work_package(1, "Desarrollado", "Pagos"),
            work_package(2, "En curso", "Auth"),
            work_package(3, "Desarrollado", "Pagos"),
        ]
        .iter()
        .filter_map(parse_item)
        .collect();
        let groups = group_by_project(tickets);
        assert_eq!(groups.len(), 2);
        assert_eq!(groups[0].project_name, "Auth");
        assert_eq!(groups[1].total, 2);
        assert_eq!(groups[1].by_status[0].count, 2);
        // Most recently updated first within the same status.
        assert_eq!(groups[1].tickets[0].id, 3);
    }
}
