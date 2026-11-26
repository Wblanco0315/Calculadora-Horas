//! Work package hierarchy queries against the OpenProject API.

pub(crate) async fn fetch_work_package_descendant_ids(
    client: &reqwest::Client,
    clean_url: &str,
    auth_value: &str,
    root_id: &str,
) -> Vec<String> {
    let mut all_ids = vec![root_id.to_string()];
    let mut frontier = vec![root_id.to_string()];
    let mut depth = 0;

    while !frontier.is_empty() && depth < 50 {
        depth += 1;
        let mut children = Vec::new();
        let filters = serde_json::json!([{
            "parent": { "operator": "=", "values": frontier }
        }])
        .to_string();
        let mut offset = 1;
        let mut has_next_page = true;

        while has_next_page {
            let endpoint = format!("{}/api/v3/work_packages", clean_url);
            let offset_value = offset.to_string();
            let response = match client
                .get(&endpoint)
                .query(&[
                    ("filters", filters.as_str()),
                    ("offset", offset_value.as_str()),
                    ("pageSize", "100"),
                    ("valid_subset", "true"),
                ])
                .header("Authorization", auth_value)
                .header("Accept", "application/hal+json, application/json")
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => response,
                _ => return all_ids,
            };
            let data: serde_json::Value = match response.json().await {
                Ok(data) => data,
                Err(_) => return all_ids,
            };
            let elements = data["_embedded"]["elements"].as_array().cloned().unwrap_or_default();
            for work_package in &elements {
                let Some(child_id) = work_package["id"]
                    .as_i64()
                    .map(|id| id.to_string())
                    .or_else(|| work_package["id"].as_str().map(|id| id.to_string()))
                else {
                    continue;
                };
                if !all_ids.contains(&child_id) {
                    all_ids.push(child_id.clone());
                    children.push(child_id);
                }
            }
            has_next_page = elements.len() == 100;
            offset += 1;
        }
        frontier = children;
    }

    all_ids
}
