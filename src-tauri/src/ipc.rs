//! Local HTTP server for the PocketProject MCP (`127.0.0.1`, random port, per-run token).
//!
//! PocketProject is the only intermediary between the MCP and OpenProject: the MCP never talks to
//! OpenProject or to the SQLite database itself.
//! - `GET /ping` (no token): version, protocol, rules version and capabilities.
//! - `POST /api/<operation>`: local data and OpenProject operations (`service::mcp_api`).
//! - `POST /action`: interface actions (open the app, switch mode, navigate, comment drafts…).
//! - `POST /notify`, `POST /show`: kept for older clients.
//!
//! Every route except `/ping` requires the token from `ipc.json` in `X-PocketProject-Token`
//! (or `Authorization: Bearer`). Each connection is served on its own thread so a slow
//! OpenProject call does not block the next request.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

use crate::service::{mcp_api, mcp_contract};

/// Largest request body accepted (comment drafts and filters are small).
const MAX_BODY_BYTES: usize = 1024 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(10);
/// OpenProject operations (reports, attachments) can take a while.
const WRITE_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct IpcInfo {
    pub port: u16,
    pub token: String,
    pub pid: u32,
}

pub(crate) fn get_ipc_file_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    app_dir.join("ipc.json")
}

pub(crate) fn cleanup_ipc_file(app: &AppHandle) {
    let path = get_ipc_file_path(app);
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

pub(crate) fn start_ipc_server(app: AppHandle) -> Result<IpcInfo, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind local IPC listener: {}", e))?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let pid = std::process::id();
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let token = format!("{:x}{:x}{:x}", pid, nanos, port);

    let info = IpcInfo {
        port,
        token: token.clone(),
        pid,
    };

    let ipc_file = get_ipc_file_path(&app);
    if let Ok(json_str) = serde_json::to_string_pretty(&info) {
        let _ = fs::write(&ipc_file, json_str);
    }

    let token = Arc::new(token);
    thread::spawn(move || {
        for stream in listener.incoming().flatten() {
            let token = Arc::clone(&token);
            let app = app.clone();
            thread::spawn(move || handle_connection(stream, &token, &app));
        }
    });

    Ok(info)
}

/// A parsed HTTP request (only what the server needs).
#[derive(Debug, PartialEq)]
pub(crate) struct Request {
    pub method: String,
    pub path: String,
    pub token: Option<String>,
    pub body: String,
}

/// Reads the request line, headers and a body of `Content-Length` bytes.
pub(crate) fn read_request<R: Read>(stream: R) -> Option<Request> {
    let mut reader = BufReader::new(stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line).ok()?;
    let mut parts = request_line.split_whitespace();
    let method = parts.next()?.to_string();
    let path = parts.next()?.to_string();

    let mut content_length = 0usize;
    let mut token = None;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).ok()? == 0 {
            break;
        }
        let line = line.trim_end_matches(['\r', '\n']);
        if line.is_empty() {
            break;
        }
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim();
        match name.trim().to_ascii_lowercase().as_str() {
            "content-length" => content_length = value.parse().unwrap_or(0),
            "x-pocketproject-token" => token = Some(value.to_string()),
            "authorization" if token.is_none() => {
                token = Some(value.strip_prefix("Bearer ").unwrap_or(value).trim().to_string())
            }
            _ => {}
        }
    }
    if content_length > MAX_BODY_BYTES {
        return None;
    }
    let mut body = vec![0u8; content_length];
    reader.read_exact(&mut body).ok()?;
    Some(Request {
        method,
        path,
        token,
        body: String::from_utf8_lossy(&body).into_owned(),
    })
}

fn handle_connection(mut stream: TcpStream, token: &str, app: &AppHandle) {
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let _ = stream.set_write_timeout(Some(WRITE_TIMEOUT));
    let Ok(reader) = stream.try_clone() else {
        return;
    };
    let Some(request) = read_request(reader) else {
        respond(&mut stream, 400, &serde_json::json!({ "error": "bad_request" }));
        return;
    };

    let path = request.path.split('?').next().unwrap_or("").to_string();
    if request.method == "GET" && (path == "/ping" || path == "/") {
        respond(&mut stream, 200, &ping_body(app));
        return;
    }
    if request.token.as_deref() != Some(token) {
        respond(&mut stream, 401, &serde_json::json!({ "error": "unauthorized" }));
        return;
    }
    if request.method != "POST" {
        respond(&mut stream, 404, &serde_json::json!({ "error": "not_found" }));
        return;
    }

    let payload: serde_json::Value = if request.body.trim().is_empty() {
        serde_json::json!({})
    } else {
        match serde_json::from_str(&request.body) {
            Ok(value) => value,
            Err(_) if path == "/notify" => serde_json::json!({ "event": "db_changed", "raw": request.body }),
            Err(error) => {
                respond(&mut stream, 400, &serde_json::json!({ "ok": false, "error": format!("JSON inválido: {}", error) }));
                return;
            }
        }
    };

    if let Some(operation) = path.strip_prefix("/api/") {
        let result = tauri::async_runtime::block_on(mcp_api::dispatch(app, operation, payload));
        match result {
            Ok(data) => respond(&mut stream, 200, &serde_json::json!({ "ok": true, "data": data })),
            Err(error) => respond(&mut stream, 200, &serde_json::json!({ "ok": false, "error": error })),
        }
        return;
    }

    match path.as_str() {
        "/action" => match mcp_api::run_action(app, payload) {
            Ok(data) => respond(&mut stream, 200, &serde_json::json!({ "ok": true, "data": data })),
            Err(error) => respond(&mut stream, 200, &serde_json::json!({ "ok": false, "error": error })),
        },
        "/notify" => {
            let _ = app.emit("db-changed", &payload);
            let _ = app.emit("mcp-event", &payload);
            respond(&mut stream, 200, &serde_json::json!({ "success": true }));
        }
        "/show" => {
            crate::app::window::show_main_window(app);
            respond(&mut stream, 200, &serde_json::json!({ "success": true }));
        }
        _ => respond(&mut stream, 404, &serde_json::json!({ "error": "not_found" })),
    }
}

fn ping_body(app: &AppHandle) -> serde_json::Value {
    serde_json::json!({
        "status": "ok",
        "app": "pocketproject",
        "version": app.package_info().version.to_string(),
        "protocolVersion": mcp_contract::MCP_PROTOCOL_VERSION,
        "minMcpVersion": mcp_contract::MIN_MCP_VERSION,
        "rulesVersion": mcp_contract::rules_version(),
        "capabilities": {
            "operations": mcp_api::OPERATIONS,
            "actions": mcp_api::ACTIONS,
        },
    })
}

fn respond(stream: &mut TcpStream, status: u16, body: &serde_json::Value) {
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        _ => "Not Found",
    };
    let body = body.to_string();
    let response = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status,
        reason,
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}

#[cfg(test)]
mod tests {
    use super::read_request;

    #[test]
    fn reads_the_whole_body_by_content_length() {
        let body = "x".repeat(20_000);
        let raw = format!(
            "POST /api/draft HTTP/1.1\r\nHost: 127.0.0.1\r\nX-PocketProject-Token: abc\r\nContent-Length: {}\r\n\r\n{}",
            body.len(),
            body
        );
        let request = read_request(raw.as_bytes()).unwrap();
        assert_eq!(request.method, "POST");
        assert_eq!(request.path, "/api/draft");
        assert_eq!(request.token.as_deref(), Some("abc"));
        assert_eq!(request.body.len(), 20_000);
    }

    #[test]
    fn accepts_a_bearer_token_and_no_body() {
        let raw = "GET /ping HTTP/1.1\r\nAuthorization: Bearer xyz\r\n\r\n";
        let request = read_request(raw.as_bytes()).unwrap();
        assert_eq!(request.token.as_deref(), Some("xyz"));
        assert!(request.body.is_empty());
    }

    #[test]
    fn rejects_a_truncated_body() {
        let raw = "POST /api/x HTTP/1.1\r\nContent-Length: 50\r\n\r\nshort";
        assert!(read_request(raw.as_bytes()).is_none());
    }
}
