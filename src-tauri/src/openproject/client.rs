//! HTTP client construction, auth header and redirect-safe attachment requests.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::time::Duration;

use crate::openproject::url::{openproject_origin, resolve_openproject_href, sanitize_url};

pub(crate) const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

pub(crate) fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(BROWSER_USER_AGENT)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))
}

pub(crate) fn build_auth_header(token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.starts_with("opapi-") || trimmed.starts_with("Bearer ") {
        if trimmed.starts_with("Bearer ") {
            trimmed.to_string()
        } else {
            format!("Bearer {}", trimmed)
        }
    } else {
        format!("Basic {}", BASE64.encode(format!("apikey:{}", trimmed)))
    }
}

/// Requests an attachment's content, following redirects and only forwarding credentials to
/// the OpenProject host. Returns the successful response and its final URL.
pub(crate) async fn request_attachment(
    url: &str,
    token: &str,
    download_url: &str,
) -> Result<(reqwest::Response, String), String> {
    let clean_url = sanitize_url(url);
    let full_url = resolve_openproject_href(&clean_url, download_url);
    let auth_value = build_auth_header(token);
    let client = reqwest::Client::builder()
        .user_agent(BROWSER_USER_AGENT)
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))?;

    let mut current_url = full_url;
    let mut current_res = client
        .get(&current_url)
        .header("Authorization", &auth_value)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    let mut redirects = 0;
    while current_res.status().is_redirection() && redirects < 5 {
        redirects += 1;
        if let Some(loc) = current_res.headers().get("location") {
            let loc_str = loc.to_str().map_err(|e| e.to_string())?;
            let next_url = resolve_openproject_href(&clean_url, loc_str);
            // Only forward credentials to the OpenProject host; external storages (S3, etc.)
            // use pre-signed URLs and reject unexpected Authorization headers.
            let same_host = openproject_origin(&clean_url) == openproject_origin(&next_url);
            current_url = next_url;
            let request = client.get(&current_url);
            let request = if same_host {
                request.header("Authorization", &auth_value)
            } else {
                request
            };
            current_res = request
                .send()
                .await
                .map_err(|e| format!("Error en conexión: {}", e))?;
        } else {
            break;
        }
    }

    if !current_res.status().is_success() {
        return Err(format!("Error HTTP {}", current_res.status()));
    }

    Ok((current_res, current_url))
}
