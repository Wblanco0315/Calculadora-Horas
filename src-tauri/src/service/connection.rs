//! OpenProject connection test and current user lookup.

use crate::model::connection::{ConnectionTestResult, OpenProjectUserResponse};
use crate::openproject::client::{build_auth_header, build_http_client};
use crate::openproject::url::sanitize_url;

pub(crate) async fn test_openproject_connection(
    url: String,
    token: String,
) -> Result<ConnectionTestResult, String> {
    let trimmed_token = token.trim();
    if trimmed_token.is_empty() {
        return Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: "El token de acceso no puede estar vacío.".to_string(),
        });
    }

    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/users/me", clean_url);
    let auth_value = build_auth_header(trimmed_token);
    let client = build_http_client(12)?;

    let response = match client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(res) => res,
        Err(err) => {
            return Ok(ConnectionTestResult {
                success: false,
                user_name: None,
                user_login: None,
                message: format!("No se pudo conectar con el servidor: {}", err),
            });
        }
    };

    let status = response.status();
    if status.is_success() {
        match response.json::<OpenProjectUserResponse>().await {
            Ok(user) => Ok(ConnectionTestResult {
                success: true,
                user_name: user.name.clone(),
                user_login: user.login,
                message: format!(
                    "¡Conexión exitosa! Bienvenido/a {}.",
                    user.name.unwrap_or_else(|| "Usuario".to_string())
                ),
            }),
            Err(e) => Ok(ConnectionTestResult {
                success: false,
                user_name: None,
                user_login: None,
                message: format!("Respuesta inválida del servidor OpenProject: {}", e),
            }),
        }
    } else if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: "Token inválido o permisos insuficientes (401/403).".to_string(),
        })
    } else {
        Ok(ConnectionTestResult {
            success: false,
            user_name: None,
            user_login: None,
            message: format!("El servidor respondió con código HTTP {}", status),
        })
    }
}

pub(crate) async fn fetch_current_user_id(url: String, token: String) -> Result<String, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/users/me", clean_url);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let response = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    let user: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    user["id"]
        .as_i64()
        .map(|id| id.to_string())
        .or_else(|| user["id"].as_str().map(|id| id.to_string()))
        .ok_or_else(|| "OpenProject no devolvió el identificador del usuario actual".to_string())
}
