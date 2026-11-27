//! Attachment preview (data URL), download to disk and upload.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::model::attachment::UploadedAttachment;
use crate::openproject::client::{build_auth_header, build_http_client, request_attachment};
use crate::openproject::url::sanitize_url;

pub(crate) async fn fetch_attachment_content(
    url: String,
    token: String,
    download_url: String,
) -> Result<String, String> {
    let (current_res, current_url) = request_attachment(&url, &token, &download_url).await?;

    let mut content_type = current_res
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    if content_type == "application/octet-stream" || content_type.starts_with("text/") {
        let lower = current_url.to_lowercase();
        if lower.ends_with(".png") {
            content_type = "image/png".to_string();
        } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
            content_type = "image/jpeg".to_string();
        } else if lower.ends_with(".gif") {
            content_type = "image/gif".to_string();
        } else if lower.ends_with(".webp") {
            content_type = "image/webp".to_string();
        } else if lower.ends_with(".svg") {
            content_type = "image/svg+xml".to_string();
        }
    }

    let bytes = current_res.bytes().await.map_err(|e| e.to_string())?;
    let encoded = BASE64.encode(&bytes);
    Ok(format!("data:{};base64,{}", content_type, encoded))
}

/// Keeps only characters that are valid in a file name on every desktop OS.
fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_end_matches('.').to_string();
    if trimmed.is_empty() {
        "attachment".to_string()
    } else {
        trimmed
    }
}

/// Returns `dir/name`, or `dir/stem (n).ext` when that file already exists.
fn unique_file_path(dir: &std::path::Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let path = std::path::Path::new(name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(name);
    let extension = path.extension().and_then(|s| s.to_str());
    (1..)
        .map(|n| match extension {
            Some(ext) => dir.join(format!("{} ({}).{}", stem, n, ext)),
            None => dir.join(format!("{} ({})", stem, n)),
        })
        .find(|p| !p.exists())
        .unwrap_or(candidate)
}

/// Downloads a work package attachment into the user's Downloads folder and returns the saved path.
pub(crate) async fn download_work_package_attachment(
    app: AppHandle,
    url: String,
    token: String,
    download_url: String,
    file_name: String,
) -> Result<String, String> {
    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("No se encontró la carpeta de descargas: {}", e))?;
    std::fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;

    let (response, _) = request_attachment(&url, &token, &download_url).await?;
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;

    let target = unique_file_path(&download_dir, &sanitize_file_name(&file_name));
    std::fs::write(&target, &bytes).map_err(|e| format!("No se pudo guardar el archivo: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

pub(crate) async fn upload_work_package_attachment(
    url: String,
    token: String,
    ticket: String,
    file_name: String,
    content_type: String,
    data_base64: String,
) -> Result<UploadedAttachment, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}/attachments", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(60)?;

    let bytes = BASE64
        .decode(data_base64.as_bytes())
        .map_err(|e| format!("Invalid file content: {}", e))?;
    let mime = if content_type.trim().is_empty() {
        "application/octet-stream".to_string()
    } else {
        content_type
    };
    let file_part = reqwest::multipart::Part::bytes(bytes)
        .file_name(file_name.clone())
        .mime_str(&mime)
        .map_err(|e| e.to_string())?;
    let metadata = serde_json::json!({ "fileName": file_name }).to_string();
    let metadata_part = reqwest::multipart::Part::text(metadata)
        .mime_str("application/json")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new()
        .part("metadata", metadata_part)
        .part("file", file_part);

    let res = client
        .post(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, err_text));
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(UploadedAttachment {
        id: data["id"]
            .as_i64()
            .map(|id| id.to_string())
            .unwrap_or_default(),
        file_name: data["fileName"].as_str().unwrap_or(&file_name).to_string(),
        content_type: data["contentType"].as_str().unwrap_or(&mime).to_string(),
        download_url: data["_links"]["downloadLocation"]["href"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
    })
}
