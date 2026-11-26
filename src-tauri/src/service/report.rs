//! Time-cost report loading (paged time entries, optional work package descendants).

use crate::model::time_entry::{PlatformTimeEntryItem, TimeCostReportFilter};
use crate::openproject::time_entry::parse_platform_time_entry;
use crate::openproject::work_package::fetch_work_package_descendant_ids;
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn load_time_cost_report_entries(
    url: String,
    token: String,
    filter: TimeCostReportFilter,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    match fetch_time_cost_report_entries(&url, &token, &filter).await {
        Err(error) if error.starts_with(HTTP_ERROR_PREFIX) => Ok(Vec::new()),
        result => result,
    }
}

const HTTP_ERROR_PREFIX: &str = "OpenProject HTTP ";

/// Same query as the time-cost report, but an HTTP error status is returned as `Err` instead of an
/// empty list, so callers that cache the result never replace good data with an error response.
pub(crate) async fn fetch_time_cost_report_entries(
    url: &str,
    token: &str,
    filter: &TimeCostReportFilter,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    let clean_url = sanitize_url(url);
    let auth_value = build_auth_header(token);
    let client = build_http_client(15)?;
    let mut filters = vec![serde_json::json!({
        "entity_type": { "operator": "=", "values": ["WorkPackage"] }
    })];

    if let Some(ticket_id) = filter.ticket_id.as_deref() {
        let raw_ticket = ticket_id.trim().trim_start_matches('#');
        if raw_ticket.is_empty() {
            return Ok(Vec::new());
        }
        let work_package_ids = if filter.include_descendants.unwrap_or(true) {
            fetch_work_package_descendant_ids(&client, &clean_url, &auth_value, raw_ticket).await
        } else {
            vec![raw_ticket.to_string()]
        };
        filters.push(serde_json::json!({
            "entity_id": { "operator": "=", "values": work_package_ids }
        }));
    }
    if let Some(project_id) = filter.project_id.as_deref().filter(|value| !value.trim().is_empty()) {
        filters.push(serde_json::json!({
            "project_id": { "operator": "=", "values": [project_id] }
        }));
    }
    if let Some(user_id) = filter.user_id.as_deref().filter(|value| !value.trim().is_empty()) {
        filters.push(serde_json::json!({ "user_id": { "operator": "=", "values": [user_id] } }));
    }
    if let Some(activity_id) = filter.activity_id.as_deref().filter(|value| !value.trim().is_empty()) {
        filters.push(serde_json::json!({
            "activity_id": { "operator": "=", "values": [activity_id] }
        }));
    }
    if let Some(spent_on) = spent_on_filter(filter.spent_on_from.as_deref(), filter.spent_on_to.as_deref()) {
        filters.push(spent_on);
    }

    let endpoint = format!("{}/api/v3/time_entries", clean_url);
    let filter_json = serde_json::Value::Array(filters).to_string();
    let mut offset = 1;
    let mut elements: Vec<serde_json::Value> = Vec::new();
    loop {
        let offset_value = offset.to_string();
        let response = client
            .get(&endpoint)
            .query(&[
                ("filters", filter_json.as_str()),
                ("offset", offset_value.as_str()),
                ("pageSize", "100"),
            ])
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("{}{}", HTTP_ERROR_PREFIX, response.status()));
        }
        let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
        let page = data["_embedded"]["elements"].as_array().cloned().unwrap_or_default();
        let has_next_page = page.len() == 100;
        elements.extend(page);
        if !has_next_page {
            break;
        }
        offset += 1;
    }

    Ok(elements.iter().filter_map(parse_platform_time_entry).collect())
}

pub(crate) async fn load_work_package_time_entries(
    url: String,
    token: String,
    ticket: String,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    load_time_cost_report_entries(
        url,
        token,
        TimeCostReportFilter {
            ticket_id: Some(ticket),
            include_descendants: Some(true),
            ..TimeCostReportFilter::default()
        },
    )
    .await
}

/// OpenProject date filters only accept date operators (`>=`/`<=` are rejected with 400
/// InvalidQuery): `<>d` is "between" and takes `[from, to]`, where either bound may be empty.
fn spent_on_filter(from: Option<&str>, to: Option<&str>) -> Option<serde_json::Value> {
    let from = from.map(str::trim).unwrap_or("");
    let to = to.map(str::trim).unwrap_or("");
    if from.is_empty() && to.is_empty() {
        return None;
    }
    Some(serde_json::json!({ "spent_on": { "operator": "<>d", "values": [from, to] } }))
}

#[cfg(test)]
mod tests {
    use super::spent_on_filter;

    #[test]
    fn builds_a_between_date_filter() {
        assert_eq!(spent_on_filter(None, Some(" ")), None);
        assert_eq!(
            spent_on_filter(Some("2026-08-26"), None).unwrap().to_string(),
            r#"{"spent_on":{"operator":"<>d","values":["2026-08-26",""]}}"#
        );
        assert_eq!(
            spent_on_filter(Some("2026-08-26"), Some("2026-11-26")).unwrap()["spent_on"]["values"][1],
            "2026-11-26"
        );
    }
}
