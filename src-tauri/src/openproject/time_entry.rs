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
    let project_id = last_href_segment(el["_links"]["project"]["href"].as_str());
    let work_package_id = last_href_segment(
        el["_links"]["entity"]["href"]
            .as_str()
            .or_else(|| el["_links"]["workPackage"]["href"].as_str()),
    );
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
        project_id,
        project_name: el["_links"]["project"]["title"].as_str().map(|value| value.to_string()),
        work_package_id,
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

fn last_href_segment(href: Option<&str>) -> Option<String> {
    href?
        .split('/')
        .filter(|segment| !segment.is_empty())
        .last()
        .map(|value| value.to_string())
}

/// Minutes of an ISO 8601 duration as OpenProject returns it (`PT1H30M`, `PT2.5H`, `P1DT2H`).
/// A day counts as 8 hours, like the frontend `isoDurationToMinutes`.
pub(crate) fn iso_duration_to_minutes(iso: &str) -> i64 {
    let upper = iso.trim().to_ascii_uppercase();
    let Some(body) = upper.strip_prefix('P') else {
        return 0;
    };
    let mut minutes = 0.0_f64;
    let mut number = String::new();
    let mut in_time = false;
    for ch in body.chars() {
        match ch {
            'T' => in_time = true,
            '0'..='9' | '.' => number.push(ch),
            unit => {
                let value: f64 = number.parse().unwrap_or(0.0);
                number.clear();
                minutes += match (unit, in_time) {
                    ('D', false) => value * 8.0 * 60.0,
                    ('W', false) => value * 5.0 * 8.0 * 60.0,
                    ('H', true) => value * 60.0,
                    ('M', true) => value,
                    ('S', true) => value / 60.0,
                    _ => 0.0,
                };
            }
        }
    }
    minutes.round() as i64
}

#[cfg(test)]
mod tests {
    use super::iso_duration_to_minutes;

    #[test]
    fn parses_openproject_durations() {
        assert_eq!(iso_duration_to_minutes("PT1H30M"), 90);
        assert_eq!(iso_duration_to_minutes("PT2.5H"), 150);
        assert_eq!(iso_duration_to_minutes("PT0.25H"), 15);
        assert_eq!(iso_duration_to_minutes("P1DT1H"), 540);
        assert_eq!(iso_duration_to_minutes("PT45M"), 45);
        assert_eq!(iso_duration_to_minutes(""), 0);
    }
}
