use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IpcInfo {
    pub port: u16,
    pub token: String,
    pub pid: u32,
}

pub fn get_ipc_file_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    if !app_dir.exists() {
        let _ = fs::create_dir_all(&app_dir);
    }
    app_dir.join("ipc.json")
}

pub fn cleanup_ipc_file(app: &AppHandle) {
    let path = get_ipc_file_path(app);
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

pub fn start_ipc_server(app: AppHandle) -> Result<IpcInfo, String> {
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

    let app_clone = app.clone();
    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                handle_connection(stream, &token, &app_clone);
            }
        }
    });

    Ok(info)
}

fn handle_connection(mut stream: TcpStream, token: &str, app: &AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(2)));

    let mut buffer = [0u8; 8192];
    let n = match stream.read(&mut buffer) {
        Ok(bytes) if bytes > 0 => bytes,
        _ => return,
    };

    let req_str = String::from_utf8_lossy(&buffer[..n]);
    let mut lines = req_str.lines();
    let request_line = match lines.next() {
        Some(l) => l,
        None => return,
    };

    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return;
    }
    let method = parts[0];
    let path = parts[1];

    if method == "OPTIONS" {
        let response = "HTTP/1.1 204 No Content\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
Access-Control-Allow-Headers: *\r\n\
Content-Length: 0\r\n\
\r\n";
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    // Extract headers
    let mut auth_ok = false;

    for line in lines {
        if line.is_empty() {
            break;
        }
        let lower = line.to_lowercase();
        if lower.starts_with("x-pocketproject-token:") {
            let val = line[22..].trim();
            if val == token {
                auth_ok = true;
            }
        } else if lower.starts_with("authorization:") {
            let val = line[14..].trim();
            if val == token || val == format!("Bearer {}", token) {
                auth_ok = true;
            }
        }
    }

    // Ping check to verify server is alive
    if method == "GET" && (path == "/ping" || path == "/") {
        let body = r#"{"status":"ok","app":"pocketproject","version":"1.0.0"}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Content-Length: {}\r\n\
\r\n\
{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if !auth_ok {
        let body = r#"{"error":"unauthorized"}"#;
        let response = format!(
            "HTTP/1.1 401 Unauthorized\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Content-Length: {}\r\n\
\r\n\
{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if method == "POST" && path == "/notify" {
        let body_str = if let Some(idx) = req_str.find("\r\n\r\n") {
            &req_str[idx + 4..]
        } else if let Some(idx) = req_str.find("\n\n") {
            &req_str[idx + 2..]
        } else {
            ""
        };

        let payload: serde_json::Value = serde_json::from_str(body_str).unwrap_or_else(|_| {
            serde_json::json!({
                "event": "db_changed",
                "raw": body_str
            })
        });

        // Emit events to the Tauri frontend
        let _ = app.emit("db-changed", &payload);
        let _ = app.emit("mcp-event", &payload);

        let body = r#"{"success":true}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Content-Length: {}\r\n\
\r\n\
{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    if method == "POST" && path == "/show" {
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
        let body = r#"{"success":true}"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\n\
Content-Type: application/json\r\n\
Access-Control-Allow-Origin: *\r\n\
Content-Length: {}\r\n\
\r\n\
{}",
            body.len(),
            body
        );
        let _ = stream.write_all(response.as_bytes());
        return;
    }

    let body = r#"{"error":"not_found"}"#;
    let response = format!(
        "HTTP/1.1 404 Not Found\r\n\
Content-Type: application/json\r\n\
Content-Length: {}\r\n\
\r\n\
{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes());
}
