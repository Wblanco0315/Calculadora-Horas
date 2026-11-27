//! Parsing of OpenProject form schemas and `allowedValues` collections.

use crate::model::time_entry::TimeEntryActivityItem;
use crate::model::work_package::WorkPackageOptionItem;

pub(crate) fn parse_allowed_value_items(list: &[serde_json::Value]) -> Vec<WorkPackageOptionItem> {
    list.iter()
        .filter_map(|value| {
            let id = value["id"]
                .as_i64()
                .map(|number| number.to_string())
                .or_else(|| value["id"].as_str().map(|value| value.to_string()))
                .or_else(|| {
                    value["href"]
                        .as_str()
                        .or_else(|| value["_links"]["self"]["href"].as_str())
                        .and_then(|href| {
                            href.split('/').filter(|segment| !segment.is_empty()).last()
                        })
                        .map(|value| value.to_string())
                })?;
            let name = value["name"]
                .as_str()
                .or_else(|| value["title"].as_str())
                .or_else(|| value["_links"]["self"]["title"].as_str())?;
            Some(WorkPackageOptionItem {
                id,
                name: name.to_string(),
                color: value["color"].as_str().map(|value| value.to_string()),
            })
        })
        .collect()
}

pub(crate) fn parse_schema_allowed_values(schema_field: &serde_json::Value) -> Vec<WorkPackageOptionItem> {
    let list = schema_field["_embedded"]["allowedValues"]
        .as_array()
        .or_else(|| schema_field["allowedValues"].as_array())
        .or_else(|| schema_field["_embedded"]["elements"].as_array())
        .or_else(|| schema_field["elements"].as_array())
        .or_else(|| schema_field["_links"]["allowedValues"].as_array());
    list.map(|values| parse_allowed_value_items(values))
        .unwrap_or_default()
}

pub(crate) async fn fetch_schema_allowed_values(
    schema_field: &serde_json::Value,
    client: &reqwest::Client,
    clean_url: &str,
    auth_value: &str,
) -> Vec<WorkPackageOptionItem> {
    let embedded = parse_schema_allowed_values(schema_field);
    if !embedded.is_empty() {
        return embedded;
    }

    let Some(href) = schema_field["_links"]["allowedValues"]["href"].as_str() else {
        return Vec::new();
    };
    let Ok(base_url) = reqwest::Url::parse(&format!("{}/", clean_url.trim_end_matches('/'))) else {
        return Vec::new();
    };

    let resolve_href = |href: &str| -> Option<String> {
        let target = if href.starts_with("/api/v3/") {
            reqwest::Url::parse(&format!("{}{}", clean_url.trim_end_matches('/'), href)).ok()?
        } else {
            base_url.join(href).ok()?
        };
        (target.origin() == base_url.origin()).then(|| target.to_string())
    };

    let mut next_url = resolve_href(href);
    let mut visited = Vec::new();
    let mut items = Vec::new();

    while let Some(endpoint) = next_url {
        if visited.len() >= 20 || visited.contains(&endpoint) {
            break;
        }
        visited.push(endpoint.clone());

        let response = match client
            .get(&endpoint)
            .header("Authorization", auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => response,
            _ => break,
        };
        let data: serde_json::Value = match response.json().await {
            Ok(data) => data,
            Err(_) => break,
        };

        let list = data["_embedded"]["elements"]
            .as_array()
            .or_else(|| data["_embedded"]["allowedValues"].as_array())
            .or_else(|| data["elements"].as_array())
            .or_else(|| data.as_array());
        if let Some(list) = list {
            items.extend(parse_allowed_value_items(list));
        } else {
            items.extend(parse_schema_allowed_values(&data));
        }

        next_url = data["_links"]["next"]["href"]
            .as_str()
            .and_then(resolve_href);
    }

    items
}

pub(crate) async fn fetch_available_people(
    client: &reqwest::Client,
    clean_url: &str,
    auth_value: &str,
    ticket: &str,
    field: &str,
) -> Vec<WorkPackageOptionItem> {
    let endpoint = format!(
        "{}/api/v3/work_packages/{}/available_{}?filters=%5B%5D&pageSize=-1&select=elements%2Fid%2Celements%2Fname%2Celements%2Femail%2Celements%2Fself%2Ctotal%2Ccount%2CpageSize",
        clean_url,
        ticket,
        field
    );
    let response = match client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/json, application/hal+json")
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return Vec::new(),
    };
    let data: serde_json::Value = match response.json().await {
        Ok(data) => data,
        Err(_) => return Vec::new(),
    };
    parse_schema_allowed_values(&data)
}

pub(crate) fn parse_activity_schema(json_val: &serde_json::Value) -> Vec<TimeEntryActivityItem> {
    let mut list = Vec::new();
    let schema_activity = json_val
        .get("_embedded")
        .and_then(|e| e.get("schema"))
        .and_then(|s| s.get("activity"))
        .or_else(|| json_val.get("schema").and_then(|s| s.get("activity")));

    if let Some(act) = schema_activity {
        // 1. Embedded allowedValues
        if let Some(embedded_values) = act
            .get("_embedded")
            .and_then(|e| e.get("allowedValues"))
            .and_then(|v| v.as_array())
        {
            for el in embedded_values {
                let id = el.get("id").and_then(|n| n.as_i64()).map(|n| n.to_string())
                    .or_else(|| el.get("id").and_then(|s| s.as_str()).map(|s| s.to_string()))
                    .or_else(|| {
                        el.get("_links")
                            .and_then(|l| l.get("self"))
                            .and_then(|s| s.get("href"))
                            .and_then(|h| h.as_str())
                            .and_then(|h| h.split('/').filter(|s| !s.is_empty()).last())
                            .map(|s| s.to_string())
                    });
                let name = el.get("name").and_then(|s| s.as_str()).map(|s| s.to_string())
                    .or_else(|| el.get("_links").and_then(|l| l.get("self")).and_then(|s| s.get("title")).and_then(|t| t.as_str()).map(|s| s.to_string()));

                if let (Some(id), Some(name)) = (id, name) {
                    list.push(TimeEntryActivityItem { id, name });
                }
            }
        }

        // 2. Linked allowedValues
        if list.is_empty() {
            let link_values = act
                .get("_links")
                .and_then(|l| l.get("allowedValues"))
                .and_then(|v| v.as_array())
                .or_else(|| act.get("allowedValues").and_then(|v| v.as_array()));

            if let Some(links) = link_values {
                for el in links {
                    let id = el.get("href")
                        .and_then(|h| h.as_str())
                        .and_then(|h| h.split('/').filter(|s| !s.is_empty()).last())
                        .map(|s| s.to_string())
                        .or_else(|| el.get("id").and_then(|n| n.as_i64()).map(|n| n.to_string()))
                        .or_else(|| el.get("id").and_then(|s| s.as_str()).map(|s| s.to_string()));
                    let name = el.get("title").and_then(|t| t.as_str()).map(|s| s.to_string())
                        .or_else(|| el.get("name").and_then(|s| s.as_str()).map(|s| s.to_string()));

                    if let (Some(id), Some(name)) = (id, name) {
                        list.push(TimeEntryActivityItem { id, name });
                    }
                }
            }
        }
    }
    list
}
