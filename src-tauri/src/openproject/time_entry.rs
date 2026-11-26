//! Parsing of OpenProject time entry resources.

use crate::model::time_entry::PlatformTimeEntryItem;

pub(crate) fn parse_platform_time_entry(el: &serde_json::Value) -> Option<PlatformTimeEntryItem> {
    let id = el["id"]
        .as_i64()
        .map(|value| value.to_string())
        .or_else(|| el["id"].as_str().map(|value| value.to_string()))?;
    let user_href = el["_links"]["user"]["href"].as_str().unwrap_or("");
    let activity_href = el["_links"]["activity"]["href"].as_str().unwrap_or("");
    let user_id = user_href
        .split('/')
        .filter(|segment| !segment.is_empty())
        .last()
        .map(|value| value.to_string());
    let activity_id = activity_href
        .split('/')
        .filter(|segment| !segment.is_empty())
        .last()
        .map(|value| value.to_string());

    Some(PlatformTimeEntryItem {
        id,
        hours: el["hours"].as_str().unwrap_or("PT0H").to_string(),
        spent_on: el["spentOn"].as_str().unwrap_or("").to_string(),
        start_time: el["startTime"].as_str().map(|value| value.to_string()),
        comment: el["comment"]["raw"]
            .as_str()
            .or_else(|| el["comment"]["html"].as_str())
            .unwrap_or("")
            .to_string(),
        user_id,
        user_name: el["_links"]["user"]["title"]
            .as_str()
            .unwrap_or("Usuario")
            .to_string(),
        activity_name: el["_links"]["activity"]["title"]
            .as_str()
            .unwrap_or("")
            .to_string(),
        activity_id,
        project_name: el["_links"]["project"]["title"].as_str().map(|value| value.to_string()),
        work_package_name: el["_links"]["entity"]["title"]
            .as_str()
            .or_else(|| el["_links"]["workPackage"]["title"].as_str())
            .map(|value| value.to_string()),
        registered_by_name: el["_links"]["author"]["title"]
            .as_str()
            .or_else(|| el["_links"]["user"]["title"].as_str())
            .map(|value| value.to_string()),
        costs: el["costs"]
            .as_str()
            .map(|value| value.to_string())
            .or_else(|| el["overallCosts"].as_str().map(|value| value.to_string())),
        created_at: el["createdAt"].as_str().map(|value| value.to_string()),
        updated_at: el["updatedAt"].as_str().map(|value| value.to_string()),
    })
}
