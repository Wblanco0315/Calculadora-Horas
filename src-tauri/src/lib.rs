mod db;
mod ipc;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use db::{open_connection, ActivityRecord, AppConfig};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub success: bool,
    pub user_name: Option<String>,
    pub user_login: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct OpenProjectUserResponse {
    name: Option<String>,
    login: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusOptionItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionOptionItem {
    pub id: String,
    pub name: String,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BoardOptionItem {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BoardWorkPackageCardItem {
    pub id: i64,
    pub subject: String,
    pub type_name: Option<String>,
    pub type_color: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub priority_name: Option<String>,
    pub assignee_name: Option<String>,
    pub project_name: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub lock_version: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumnOptionItem {
    pub query_id: String,
    pub name: String,
    pub widget_id: i64,
    pub start_column: i64,
    pub work_package_ids: Vec<i64>,
    pub work_packages: Vec<BoardWorkPackageCardItem>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageOptionItem {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageFormSchemaResult {
    pub statuses: Vec<WorkPackageOptionItem>,
    pub priorities: Vec<WorkPackageOptionItem>,
    pub assignees: Vec<WorkPackageOptionItem>,
    pub responsibles: Vec<WorkPackageOptionItem>,
    pub versions: Vec<WorkPackageOptionItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageUpdateStreamResult {
    pub available: bool,
    pub has_updates: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageRevisionItem {
    pub id: String,
    pub lock_version: i64,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkPackageCostSummaryItem {
    pub labor_costs: Option<String>,
    pub material_costs: Option<String>,
    pub overall_costs: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkPackagePayload {
    pub lock_version: Option<i64>,
    pub subject: Option<String>,
    pub description_raw: Option<String>,
    pub start_date: Option<String>,
    pub clear_start_date: Option<bool>,
    pub due_date: Option<String>,
    pub clear_due_date: Option<bool>,
    pub estimated_time: Option<String>,
    pub status_id: Option<String>,
    pub priority_id: Option<String>,
    pub assignee_id: Option<String>,
    pub clear_assignee: Option<bool>,
    pub responsible_id: Option<String>,
    pub clear_responsible: Option<bool>,
    pub version_id: Option<String>,
    pub clear_version: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformTimeEntryItem {
    pub id: String,
    pub hours: String,
    pub spent_on: String,
    pub start_time: Option<String>,
    pub comment: String,
    pub user_id: Option<String>,
    pub user_name: String,
    pub activity_name: String,
    pub activity_id: Option<String>,
    pub project_name: Option<String>,
    pub work_package_name: Option<String>,
    pub registered_by_name: Option<String>,
    pub costs: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimeEntryPayload {
    pub hours: String,
    pub spent_on: String,
    pub comment: String,
    pub activity_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TimeCostReportFilter {
    pub ticket_id: Option<String>,
    pub project_id: Option<String>,
    pub user_id: Option<String>,
    pub activity_id: Option<String>,
    pub spent_on_from: Option<String>,
    pub spent_on_to: Option<String>,
    pub include_descendants: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoveColumnResult {
    pub ok: bool,
    pub status_id: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketInfoResult {
    pub success: bool,
    pub subject: Option<String>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub version_id: Option<String>,
    pub version_name: Option<String>,
    pub lock_version: Option<i64>,
    pub available_statuses: Option<Vec<StatusOptionItem>>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketDescriptionItem {
    pub raw: Option<String>,
    pub html: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TicketActivityDetailItem {
    pub raw: String,
    pub html: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TicketCommentItem {
    pub id: String,
    #[serde(alias = "comment_raw")]
    pub comment_raw: String,
    #[serde(alias = "comment_html")]
    pub comment_html: String,
    #[serde(alias = "created_at")]
    pub created_at: String,
    #[serde(alias = "user_name")]
    pub user_name: String,
    #[serde(default)]
    pub details: Vec<TicketActivityDetailItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TicketAttachmentItem {
    pub id: String,
    #[serde(alias = "file_name")]
    pub file_name: String,
    #[serde(alias = "file_size")]
    pub file_size: i64,
    #[serde(alias = "content_type")]
    pub content_type: String,
    #[serde(alias = "download_url")]
    pub download_url: String,
    #[serde(alias = "is_image")]
    pub is_image: bool,
    #[serde(alias = "created_at")]
    pub created_at: Option<String>,
    #[serde(alias = "author_name")]
    pub author_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TicketContextResult {
    pub success: bool,
    pub ticket: String,
    pub subject: Option<String>,
    pub type_name: Option<String>,
    pub author_name: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub description: Option<TicketDescriptionItem>,
    pub comments: Option<Vec<TicketCommentItem>>,
    pub attachments: Option<Vec<TicketAttachmentItem>>,
    pub project_id: Option<String>,
    pub project_name: Option<String>,
    pub status_id: Option<String>,
    pub status_name: Option<String>,
    pub status_color: Option<String>,
    pub version_id: Option<String>,
    pub version_name: Option<String>,
    pub priority_name: Option<String>,
    pub assignee_name: Option<String>,
    pub responsible_name: Option<String>,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub estimated_time: Option<String>,
    pub spent_time: Option<String>,
    pub lock_version: Option<i64>,
    pub available_statuses: Option<Vec<StatusOptionItem>>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OpenProjectProjectItem {
    pub id: String,
    pub name: String,
    pub identifier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeEntryActivityItem {
    pub id: String,
    pub name: String,
}

#[tauri::command]
fn get_app_config(app: AppHandle) -> Result<Option<AppConfig>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::load_config(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_app_config(app: AppHandle, config: AppConfig) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::save_config(&conn, &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_is_configured(app: AppHandle) -> Result<bool, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::is_configured(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_activities(app: AppHandle, date: Option<String>) -> Result<Vec<ActivityRecord>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::load_activities(&conn, date.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_activity(app: AppHandle, activity: ActivityRecord) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::save_activity(&conn, &activity).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_activity(app: AppHandle, id: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::delete_activity(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_activities(app: AppHandle, date: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::clear_activities_for_date(&conn, &date).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_database_path(app: AppHandle) -> Result<String, String> {
    let path = db::get_db_path(&app);
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_ai_stats(app: AppHandle) -> Result<i32, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::count_ai_activities(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_favorite_tickets(app: AppHandle) -> Result<Vec<db::FavoriteTicketRecord>, String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::load_favorite_tickets(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_favorite_ticket(app: AppHandle, ticket: db::FavoriteTicketRecord) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::save_favorite_ticket(&conn, &ticket).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_favorite_ticket(app: AppHandle, ticket: String) -> Result<(), String> {
    let conn = open_connection(&app).map_err(|e| e.to_string())?;
    db::delete_favorite_ticket(&conn, &ticket).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct McpInstallResult {
    pub success: bool,
    pub path: String,
    pub message: String,
}

#[tauri::command]
fn install_mcp_to_client(client: String) -> Result<McpInstallResult, String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let home_path = PathBuf::from(&home);

    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    let is_opencode = client.as_str() == "opencode";
    let (target_file, command, args) = match client.as_str() {
        "antigravity" => {
            let config_dir = home_path.join(".gemini").join("config");
            let file = config_dir.join("mcp_config.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        "antigravity_workspace" => {
            let config_dir = cwd.join(".gemini");
            let file = config_dir.join("mcp_config.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        "cursor" => {
            let config_dir = cwd.join(".cursor");
            let file = config_dir.join("mcp.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        "claude_code" => {
            let file = home_path.join(".claude.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        "claude_desktop" => {
            let app_data = std::env::var("APPDATA").unwrap_or_else(|_| home.clone());
            let config_dir = PathBuf::from(app_data).join("Claude");
            let file = config_dir.join("claude_desktop_config.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        "opencode" => {
            let config_dir = home_path.join(".config").join("opencode");
            let file = config_dir.join("opencode.json");
            (file, "npx".to_string(), vec!["-y".to_string(), "pocketproject-mcp@latest".to_string()])
        }
        _ => return Err(format!("Cliente no soportado: {}", client)),
    };

    if let Some(parent) = target_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut root_val: serde_json::Value = if target_file.exists() {
        let content = std::fs::read_to_string(&target_file).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if !root_val.is_object() {
        root_val = serde_json::json!({});
    }

    if is_opencode {
        let mcp = root_val
            .as_object_mut()
            .unwrap()
            .entry("mcp")
            .or_insert_with(|| serde_json::json!({}));

        if !mcp.is_object() {
            *mcp = serde_json::json!({});
        }

        let pocketproject_config = serde_json::json!({
            "type": "local",
            "command": vec!["npx".to_string(), "-y".to_string(), "pocketproject-mcp@latest".to_string()],
            "enabled": true
        });

        mcp.as_object_mut().unwrap().insert("pocketproject".to_string(), pocketproject_config);
    } else {
        let servers = root_val
            .as_object_mut()
            .unwrap()
            .entry("mcpServers")
            .or_insert_with(|| serde_json::json!({}));

        if !servers.is_object() {
            *servers = serde_json::json!({});
        }

        let pocketproject_config = serde_json::json!({
            "command": command,
            "args": args
        });

        servers.as_object_mut().unwrap().insert("pocketproject".to_string(), pocketproject_config);
    }

    let formatted = serde_json::to_string_pretty(&root_val).map_err(|e| e.to_string())?;
    std::fs::write(&target_file, formatted).map_err(|e| e.to_string())?;

    Ok(McpInstallResult {
        success: true,
        path: target_file.to_string_lossy().to_string(),
        message: format!("Configuración inyectada con éxito en {}", target_file.to_string_lossy()),
    })
}

#[tauri::command]
fn inject_ai_rules() -> Result<McpInstallResult, String> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let agents_rules = cwd.join(".agents").join("RULES.md");
    let cursor_rules = cwd.join(".cursorrules");

    let rule_content = r#"

<!-- POCKETPROJECT MCP RULES START -->
## Directrices Obligatorias de PocketProject Time Tracker (MCP):
Eres un asistente de software conectado a PocketProject vía Model Context Protocol (MCP).
Tu objetivo es registrar y gestionar de forma proactiva, exacta y profesional el tiempo dedicado a las tareas.

### 1. Interpretación de Términos Comunes:
- "Necesito llenar el ticket 11111", "Cargar horas a 11111", "Imputar tiempo en 11111", "Trabajé en el ticket 11111" -> Significa registrar una actividad ('add_activity') asociada al ticket 11111 tras verificar su contexto.
- "Empezar con el ticket 11111" -> Significa iniciar el cronómetro con 'start_timer'.
- "Resumen de hoy" o "¿Cómo voy hoy?" -> 'get_today_summary'.
- "¿Qué registré en el ticket 11111?" -> 'get_ticket_context(ticket: "11111", include_time_entries: true)' o 'search_activities'.
- "¿Quién soy?", "Información de mi usuario" -> 'get_user_info'.
- "Listar proyectos", "Ver proyectos" -> 'get_projects'.
- "Listar estados", "¿Cuáles son los estados de OpenProject?" -> 'get_statuses'.
- "Cambiar estado del ticket 11111 a [estado]" -> 'update_ticket_status'.
- "Ver tableros del proyecto", "Columnas del tablero" -> 'get_project_boards' / 'get_board_columns'.
- "Mover ticket 11111 a la columna [columna]" -> 'move_ticket_column'.

### 2. Protocolo Estricto de Tickets (ANTI-ALUCINACIÓN):
- **PROHIBIDO INVENTAR TICKETS**: Jamás generes un número de ticket al azar ni asignes un ticket que el usuario no haya escrito textualmente.
- Si no hay ticket, el campo debe ser omitido o null.
- Si el usuario menciona un ticket (ej. 11111):
  1. Ejecuta PRIMERO 'get_ticket_context(ticket: "11111")' (resolución en cascada: Favoritos/Historial local -> OpenProject API en vivo).
  2. Si 'found: true': Utiliza el título oficial ('subject') y proyecto recuperados para registrar la actividad ('add_activity') o cronómetro ('start_timer').
  3. Si 'found: false': PREGUNTA AL USUARIO:
     "No encontré el ticket #11111 en OpenProject ni en favoritos. ¿El Project Manager o encargado ya creó este ticket en el sistema?"
     - Si el usuario indica que aún no está creado: registra la actividad con ticket null y descripción profesional, indicando que queda pendiente de ticket.
     - Si el usuario corrige el número: vuelve al paso 1 con el nuevo ticket.

### 3. Herramientas MCP Disponibles:
1. get_today_summary: Balance del día (horas trabajadas, meta, minutos restantes).
2. get_ticket_context: Resolución del ticket (título, proyecto, estado, prioridad, asignado, descripción). Banderas: 'include_description' (def: true), 'include_comments' (def: false), 'include_attachments' (def: false), 'include_time_entries' (def: false).
3. get_ticket_attachment: Descarga y retorna contenido de un archivo/adjunto o imagen. (OBLIGATORIO pedir permiso al usuario).
4. search_activities: Búsqueda profunda en historial por ticket, descripción o rango de fechas.
5. search_tickets: Búsqueda unificada en favoritos, historial y OpenProject en vivo.
6. get_activities: Lista actividades registradas en una fecha.
7. add_activity: Registra una actividad (autocompleta desde OpenProject o favoritos).
8. edit_activity: Actualiza descripción, minutos o ticket de una actividad existente.
9. start_timer: Inicia cronómetro para una tarea activa (pausa el anterior).
10. stop_timer: Detiene cronómetro activo y consolida minutos.
11. get_favorite_tickets: Lista tickets favoritos con título y proyecto.
12. add_favorite_ticket: Guarda un ticket frecuente en favoritos.
13. get_openproject_context: Información del usuario y configuración OpenProject.
14. get_user_info: Perfil completo del usuario OpenProject autenticado.
15. get_projects: Lista y búsqueda de proyectos de OpenProject.
16. get_statuses: Lista oficial de estados de OpenProject.
17. update_ticket_status: Actualiza el estado de un ticket en OpenProject.
18. get_project_boards / get_board_columns: Consulta tableros Kanban y columnas de un proyecto.
19. move_ticket_column: Mueve un ticket de columna en un tablero y sincroniza su estado.

### 4. Lectura Progresiva de Contexto y Permisos de Archivos:
- **Lectura Normal de Descripción**: Al consultar un ticket con 'get_ticket_context(ticket: "11111")', se incluye automáticamente la descripción ('include_description: true'). Lee y comprende la descripción para contextualizar la tarea.
- **Sugerir Lectura de Comentarios**: Tras leer la descripción, sugiere proactivamente al usuario si desea que consultes también los comentarios o notas del ticket:
  *"He leído la descripción del ticket. ¿Deseas que revise los comentarios para obtener más detalles?"*
  - Si el usuario lo autoriza o lo pide, ejecuta 'get_ticket_context(ticket: "11111", include_comments: true)'.
- **Permisos Obligatorios para Archivos y Adjuntos**:
  - Si el ticket tiene archivos adjuntos o imágenes ('include_attachments: true'), o si necesitas inspeccionar un archivo adjunto con 'get_ticket_attachment':
  - **NUNCA descargues ni abras un archivo sin el consentimiento explícito del usuario**.
  - Pide permiso explícito: *"El ticket contiene el archivo adjunto [nombre]. ¿Me autorizas a descargarlo y revisar su contenido?"*
  - Solo tras la confirmación afirmativa del usuario, ejecuta 'get_ticket_attachment(download_url: "...")'.

### 5. Flujo de Trabajo y Ciclo de Vida del Ticket (Estados y Tableros):
- **Roles**: El PM crea o se le solicita el ticket. El Responsable supervisa y el Asignado implementa y solventa la tarea.
- **Inicio y Borrador para el PM**: Al iniciar, si el usuario no tiene número de ticket, pedirle el número o indicarle que lo solicite al PM. Si se le va a pedir al PM, el agente debe ofrecer generarle el borrador en texto con el formato estructurado (Nombre de ticket, Descripción, Tiempo, Fecha Inicio y Fin).
- **Comprobación de Columnas Reales**: El agente DEBE SIEMPRE extraer y verificar las columnas reales del tablero ('get_board_columns') antes de intentar mover un ticket, sin asumir nombres fijos sin contrastar.
- **Protección contra cambios concurrentes**: Antes de modificar un estado o mover una tarjeta, consulta 'get_ticket_context' y envía el 'lockVersion' actual como 'lock_version'. Si el stream o lockVersion indica cambios remotos, no reintentes ni descartes el contexto automáticamente; vuelve a consultar y pide confirmación al usuario.
- **En Desarrollo**: Al trabajar en la tarea, colocar en estado "En desarrollo" y mover a columna real correspondiente ("HACER HOY" o "EN CURSO", consultando al usuario cuál prefiere).
- **Justificado**: Si el problema no tiene solución técnica viable o es el comportamiento esperado del sistema, estado "Justificado".
- **Bloqueo / Dependencia**: Si depende de otra tarea para avanzar, estado "En espera" y columna "BLOQUEANTE".
- **Terminado**: Al finalizar el desarrollo, estado "Desarrollado" y columna "DESARROLLADO".
- **Prueba Fallida**: Si el ticket está en "Prueba fallida", la solución anterior falló. Investigar leyendo descripción, comentarios y archivos (con permiso).
- **Cierre / Producción**: Tras superar QA y desplegar a producción sin problemas, el PM o el asignado delegado pasan a estado "Cerrado" y columna "FINALIZADO".
- **Confirmación Obligatoria**: Ante cualquier duda o transición, PREGUNTAR SIEMPRE al usuario mostrando las opciones disponibles. NUNCA cambiar estados ni mover columnas sin autorización expresa.
<!-- POCKETPROJECT MCP RULES END -->
"#;

    let target_file = if agents_rules.exists() {
        agents_rules
    } else if cursor_rules.exists() {
        cursor_rules
    } else {
        cwd.join("AGENTS.md")
    };

    let existing = std::fs::read_to_string(&target_file).unwrap_or_default();
    if !existing.contains("POCKETPROJECT MCP RULES") {
        let mut new_content = existing;
        new_content.push_str(rule_content);
        std::fs::write(&target_file, new_content).map_err(|e| e.to_string())?;
    }

    Ok(McpInstallResult {
        success: true,
        path: target_file.to_string_lossy().to_string(),
        message: format!("Reglas inyectadas en {}", target_file.to_string_lossy()),
    })
}

fn sanitize_url(url: &str) -> String {
    let mut clean = url.trim().trim_end_matches('/').to_string();
    if clean.is_empty() {
        clean = "https://openproject.wposs.com/openproject".to_string();
    }
    if clean.ends_with("/api/v3") {
        clean = clean[..clean.len() - 7].to_string();
    }
    clean
}

/// Returns the scheme + host (+ port) portion of an absolute URL.
fn openproject_origin(url: &str) -> String {
    match url.find("://") {
        Some(scheme_end) => {
            let after = &url[scheme_end + 3..];
            match after.find('/') {
                Some(path_start) => url[..scheme_end + 3 + path_start].to_string(),
                None => url.to_string(),
            }
        }
        None => url.to_string(),
    }
}

/// Resolves an OpenProject href (absolute, root-relative or relative) against the configured
/// base URL, avoiding a duplicated relative root (e.g. `/openproject/openproject/api/v3/...`).
fn resolve_openproject_href(clean_url: &str, href: &str) -> String {
    let href = href.trim();
    if href.starts_with("http://") || href.starts_with("https://") {
        return href.to_string();
    }
    let origin = openproject_origin(clean_url);
    let base_path = clean_url[origin.len()..].trim_end_matches('/');
    if href.starts_with('/') {
        if !base_path.is_empty()
            && (href == base_path || href.starts_with(&format!("{}/", base_path)))
        {
            return format!("{}{}", origin, href);
        }
        return format!("{}{}", clean_url, href);
    }
    format!("{}/{}", clean_url, href)
}

const BROWSER_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

fn build_http_client(timeout_secs: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(BROWSER_USER_AGENT)
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("Error creando cliente HTTP: {}", e))
}

fn build_auth_header(token: &str) -> String {
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

#[tauri::command]
async fn test_openproject_connection(
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

#[tauri::command]
async fn fetch_ticket_info(
    url: String,
    token: String,
    ticket: String,
) -> Result<TicketInfoResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    if raw_ticket.is_empty() {
        return Ok(TicketInfoResult {
            success: false,
            subject: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            lock_version: None,
            available_statuses: None,
            message: "Ticket no especificado.".to_string(),
        });
    }

    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if !res.status().is_success() {
        return Ok(TicketInfoResult {
            success: false,
            subject: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            lock_version: None,
            available_statuses: None,
            message: format!("Error HTTP {}", res.status()),
        });
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let subject = json_val["subject"].as_str().map(|s| s.to_string());
    let project_name = json_val["_links"]["project"]["title"].as_str().map(|s| s.to_string());
    let project_id = json_val["_links"]["project"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_name = json_val["_links"]["status"]["title"].as_str().map(|s| s.to_string());
    let status_id = json_val["_links"]["status"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_color = json_val["_embedded"]["status"]["color"]
        .as_str()
        .or_else(|| json_val["status"]["color"].as_str())
        .map(|s| s.to_string());

    let version_name = json_val["_links"]["version"]["title"].as_str().map(|s| s.to_string());
    let version_id = json_val["_links"]["version"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let lock_version = json_val["lockVersion"].as_i64();

    // Query form endpoint to fetch allowed statuses
    let form_endpoint = format!("{}/api/v3/work_packages/{}/form", clean_url, raw_ticket);
    let mut available_statuses: Option<Vec<StatusOptionItem>> = None;
    let form_body = match lock_version {
        Some(lv) => serde_json::json!({ "lockVersion": lv }).to_string(),
        None => "{}".to_string(),
    };

    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .body(form_body)
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let schema_status = &form_json["_embedded"]["schema"]["status"];
                let allowed_raw = schema_status["_embedded"]["allowedValues"]
                    .as_array()
                    .or_else(|| schema_status["allowedValues"].as_array())
                    .or_else(|| schema_status["_links"]["allowedValues"].as_array());

                if let Some(arr) = allowed_raw {
                    let mut list = Vec::new();
                    for item in arr {
                        let id = item["id"]
                            .as_i64()
                            .map(|i| i.to_string())
                            .or_else(|| item["href"].as_str().and_then(|h| h.split('/').last().map(|s| s.to_string())));
                        let name = item["name"]
                            .as_str()
                            .or_else(|| item["title"].as_str())
                            .map(|s| s.to_string());
                        let color = item["color"].as_str().map(|s| s.to_string());

                        if let (Some(id_str), Some(name_str)) = (id, name) {
                            list.push(StatusOptionItem {
                                id: id_str,
                                name: name_str,
                                color,
                            });
                        }
                    }
                    if !list.is_empty() {
                        available_statuses = Some(list);
                    }
                }
            }
        }
    }

    // Resilient fallback: if form did not return available statuses, fetch all project statuses
    if available_statuses.as_ref().map_or(true, |v| v.is_empty()) {
        if let Ok(all) = fetch_statuses(clean_url.clone(), token.clone()).await {
            if !all.is_empty() {
                available_statuses = Some(all);
            }
        }
    }

    Ok(TicketInfoResult {
        success: true,
        subject,
        project_id,
        project_name,
        status_id,
        status_name,
        status_color,
        version_id,
        version_name,
        lock_version,
        available_statuses,
        message: "Ticket cargado".to_string(),
    })
}

#[tauri::command]
async fn fetch_ticket_context(
    url: String,
    token: String,
    ticket: String,
    include_description: Option<bool>,
    include_comments: Option<bool>,
    include_attachments: Option<bool>,
) -> Result<TicketContextResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    if raw_ticket.is_empty() {
        return Ok(TicketContextResult {
            success: false,
            ticket: ticket.clone(),
            subject: None,
            type_name: None,
            author_name: None,
            created_at: None,
            updated_at: None,
            description: None,
            comments: None,
            attachments: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            priority_name: None,
            assignee_name: None,
            responsible_name: None,
            start_date: None,
            due_date: None,
            estimated_time: None,
            spent_time: None,
            lock_version: None,
            available_statuses: None,
            message: "Ticket no especificado.".to_string(),
        });
    }

    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if !res.status().is_success() {
        return Ok(TicketContextResult {
            success: false,
            ticket: format!("#{}", raw_ticket),
            subject: None,
            type_name: None,
            author_name: None,
            created_at: None,
            updated_at: None,
            description: None,
            comments: None,
            attachments: None,
            project_id: None,
            project_name: None,
            status_id: None,
            status_name: None,
            status_color: None,
            version_id: None,
            version_name: None,
            priority_name: None,
            assignee_name: None,
            responsible_name: None,
            start_date: None,
            due_date: None,
            estimated_time: None,
            spent_time: None,
            lock_version: None,
            available_statuses: None,
            message: format!("Error HTTP {}", res.status()),
        });
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let subject = json_val["subject"].as_str().map(|s| s.to_string());
    let project_name = json_val["_links"]["project"]["title"].as_str().map(|s| s.to_string());
    let project_id = json_val["_links"]["project"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_name = json_val["_links"]["status"]["title"].as_str().map(|s| s.to_string());
    let status_id = json_val["_links"]["status"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let status_color = json_val["_embedded"]["status"]["color"]
        .as_str()
        .or_else(|| json_val["status"]["color"].as_str())
        .map(|s| s.to_string());

    let version_name = json_val["_links"]["version"]["title"].as_str().map(|s| s.to_string());
    let version_id = json_val["_links"]["version"]["href"]
        .as_str()
        .and_then(|href| href.split('/').last())
        .map(|s| s.to_string());

    let type_name = json_val["_links"]["type"]["title"]
        .as_str()
        .or_else(|| json_val["_embedded"]["type"]["title"].as_str())
        .map(|s| s.to_string());
    let author_name = json_val["_links"]["author"]["title"].as_str().map(|s| s.to_string());
    let created_at = json_val["createdAt"].as_str().map(|s| s.to_string());
    let updated_at = json_val["updatedAt"].as_str().map(|s| s.to_string());
    let priority_name = json_val["_links"]["priority"]["title"].as_str().map(|s| s.to_string());
    let assignee_name = json_val["_links"]["assignee"]["title"].as_str().map(|s| s.to_string());
    let responsible_name = json_val["_links"]["responsible"]["title"].as_str().map(|s| s.to_string());
    let start_date = json_val["startDate"].as_str().map(|s| s.to_string());
    let due_date = json_val["dueDate"].as_str().map(|s| s.to_string());
    let estimated_time = json_val["estimatedTime"].as_str().map(|s| s.to_string());
    let spent_time = json_val["spentTime"].as_str().map(|s| s.to_string());
    let lock_version = json_val["lockVersion"].as_i64();

    // 1. Description
    let description = if include_description.unwrap_or(true) {
        let desc_obj = &json_val["description"];
        if desc_obj.is_object() {
            Some(TicketDescriptionItem {
                raw: desc_obj["raw"].as_str().map(|s| s.to_string()),
                html: desc_obj["html"].as_str().map(|s| s.to_string()),
                format: desc_obj["format"].as_str().map(|s| s.to_string()),
            })
        } else {
            None
        }
    } else {
        None
    };

    // 2. Comments / Activities
    let comments = if include_comments.unwrap_or(false) {
        let act_endpoint = format!("{}/api/v3/work_packages/{}/activities", clean_url, raw_ticket);
        if let Ok(act_res) = client
            .get(&act_endpoint)
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
        {
            if act_res.status().is_success() {
                if let Ok(act_json) = act_res.json::<serde_json::Value>().await {
                    let elements = act_json["_embedded"]["elements"].as_array();
                    if let Some(arr) = elements {
                        // Pre-populate known users from work package fields
                        let mut known_users: std::collections::HashMap<String, String> = std::collections::HashMap::new();
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["author"]["href"].as_str(),
                            json_val["_links"]["author"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["assignee"]["href"].as_str(),
                            json_val["_links"]["assignee"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }
                        if let (Some(href), Some(title)) = (
                            json_val["_links"]["responsible"]["href"].as_str(),
                            json_val["_links"]["responsible"]["title"].as_str(),
                        ) {
                            let uid = href.split('/').last().unwrap_or("");
                            if !uid.is_empty() {
                                known_users.insert(uid.to_string(), title.to_string());
                            }
                        }

                        // Collect unique user IDs from activities that aren't known yet
                        let mut missing_uids = std::collections::HashSet::new();
                        for a in arr {
                            if let Some(href) = a["_links"]["user"]["href"].as_str() {
                                let uid = href.split('/').last().unwrap_or("");
                                if !uid.is_empty() && !known_users.contains_key(uid) {
                                    missing_uids.insert(uid.to_string());
                                }
                            }
                        }

                        // Fetch names for missing user IDs
                        for uid in missing_uids {
                            let user_endpoint = format!("{}/api/v3/users/{}", clean_url, uid);
                            if let Ok(u_res) = client
                                .get(&user_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Accept", "application/hal+json, application/json")
                                .send()
                                .await
                            {
                                if u_res.status().is_success() {
                                    if let Ok(u_json) = u_res.json::<serde_json::Value>().await {
                                        if let Some(name) = u_json["name"].as_str() {
                                            known_users.insert(uid.clone(), name.to_string());
                                        }
                                    }
                                }
                            }
                        }

                        let mut list = Vec::new();
                        for a in arr {
                            let comment_obj = &a["comment"];
                            let raw_c = comment_obj["raw"].as_str().unwrap_or("").trim();
                            let html_c = comment_obj["html"].as_str().unwrap_or("").trim();

                            let mut details_list = Vec::new();
                            if let Some(d_arr) = a["details"].as_array() {
                                for d in d_arr {
                                    let raw_d = d["raw"].as_str().unwrap_or("").trim();
                                    let html_d = d["html"].as_str().unwrap_or("").trim();
                                    if !raw_d.is_empty() || !html_d.is_empty() {
                                        details_list.push(TicketActivityDetailItem {
                                            raw: raw_d.to_string(),
                                            html: if html_d.is_empty() { raw_d.to_string() } else { html_d.to_string() },
                                        });
                                    }
                                }
                            }

                            // Keep activity if it has a note OR details
                            if !raw_c.is_empty() || !html_c.is_empty() || !details_list.is_empty() {
                                let id = a["id"].as_i64().map(|i| i.to_string()).unwrap_or_default();
                                let created_at = a["createdAt"].as_str().unwrap_or("").to_string();

                                let user_href = a["_links"]["user"]["href"].as_str().unwrap_or("");
                                let uid = user_href.split('/').last().unwrap_or("");
                                let user_name = if let Some(known) = known_users.get(uid) {
                                    known.clone()
                                } else if let Some(title) = a["_links"]["user"]["title"].as_str() {
                                    title.to_string()
                                } else if !uid.is_empty() {
                                    format!("Usuario #{}", uid)
                                } else {
                                    "Desconocido".to_string()
                                };

                                list.push(TicketCommentItem {
                                    id,
                                    comment_raw: raw_c.to_string(),
                                    comment_html: if html_c.is_empty() { raw_c.to_string() } else { html_c.to_string() },
                                    created_at,
                                    user_name,
                                    details: details_list,
                                });
                            }
                        }
                        Some(list)
                    } else {
                        Some(Vec::new())
                    }
                } else {
                    Some(Vec::new())
                }
            } else {
                Some(Vec::new())
            }
        } else {
            Some(Vec::new())
        }
    } else {
        None
    };

    // 3. Attachments
    let attachments = if include_attachments.unwrap_or(false) {
        let att_endpoint = format!("{}/api/v3/work_packages/{}/attachments", clean_url, raw_ticket);
        if let Ok(att_res) = client
            .get(&att_endpoint)
            .header("Authorization", &auth_value)
            .header("Accept", "application/hal+json, application/json")
            .send()
            .await
        {
            if att_res.status().is_success() {
                if let Ok(att_json) = att_res.json::<serde_json::Value>().await {
                    let elements = att_json["_embedded"]["elements"].as_array();
                    if let Some(arr) = elements {
                        let mut list = Vec::new();
                        for att in arr {
                            let id = att["id"].as_i64().map(|i| i.to_string()).unwrap_or_default();
                            let file_name = att["fileName"].as_str().unwrap_or("archivo").to_string();
                            let file_size = att["fileSize"].as_i64().unwrap_or(0);
                            let content_type = att["contentType"].as_str().unwrap_or("application/octet-stream").to_string();
                            let mut download_url = att["_links"]["downloadLocation"]["href"].as_str().unwrap_or("").to_string();
                            if download_url.is_empty() && !id.is_empty() {
                                download_url = format!("/api/v3/attachments/{}/content", id);
                            }
                            let is_image = content_type.starts_with("image/")
                                || file_name.ends_with(".png")
                                || file_name.ends_with(".jpg")
                                || file_name.ends_with(".jpeg")
                                || file_name.ends_with(".webp")
                                || file_name.ends_with(".gif");
                            let created_at = att["createdAt"].as_str().map(|s| s.to_string());
                            let author_name = att["_links"]["author"]["title"].as_str().map(|s| s.to_string());
                            list.push(TicketAttachmentItem {
                                id,
                                file_name,
                                file_size,
                                content_type,
                                download_url,
                                is_image,
                                created_at,
                                author_name,
                            });
                        }
                        Some(list)
                    } else {
                        Some(Vec::new())
                    }
                } else {
                    Some(Vec::new())
                }
            } else {
                Some(Vec::new())
            }
        } else {
            Some(Vec::new())
        }
    } else {
        None
    };

    // 4. Form endpoint for allowed statuses
    let form_endpoint = format!("{}/api/v3/work_packages/{}/form", clean_url, raw_ticket);
    let mut available_statuses: Option<Vec<StatusOptionItem>> = None;
    let form_body = match lock_version {
        Some(lv) => serde_json::json!({ "lockVersion": lv }).to_string(),
        None => "{}".to_string(),
    };

    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .body(form_body)
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let schema_status = &form_json["_embedded"]["schema"]["status"];
                let allowed_raw = schema_status["_embedded"]["allowedValues"]
                    .as_array()
                    .or_else(|| schema_status["allowedValues"].as_array())
                    .or_else(|| schema_status["_links"]["allowedValues"].as_array());

                if let Some(arr) = allowed_raw {
                    let mut list = Vec::new();
                    for item in arr {
                        let id = item["id"]
                            .as_i64()
                            .map(|i| i.to_string())
                            .or_else(|| item["href"].as_str().and_then(|h| h.split('/').last().map(|s| s.to_string())));
                        let name = item["name"]
                            .as_str()
                            .or_else(|| item["title"].as_str())
                            .map(|s| s.to_string());
                        let color = item["color"].as_str().map(|s| s.to_string());

                        if let (Some(id_str), Some(name_str)) = (id, name) {
                            list.push(StatusOptionItem {
                                id: id_str,
                                name: name_str,
                                color,
                            });
                        }
                    }
                    if !list.is_empty() {
                        available_statuses = Some(list);
                    }
                }
            }
        }
    }

    // Resilient fallback: if form did not return available statuses, fetch all project statuses
    if available_statuses.as_ref().map_or(true, |v| v.is_empty()) {
        if let Ok(all) = fetch_statuses(clean_url.clone(), token.clone()).await {
            if !all.is_empty() {
                available_statuses = Some(all);
            }
        }
    }

    Ok(TicketContextResult {
        success: true,
        ticket: format!("#{}", raw_ticket),
        subject,
        type_name,
        author_name,
        created_at,
        updated_at,
        description,
        comments,
        attachments,
        project_id,
        project_name,
        status_id,
        status_name,
        status_color,
        version_id,
        version_name,
        priority_name,
        assignee_name,
        responsible_name,
        start_date,
        due_date,
        estimated_time,
        spent_time,
        lock_version,
        available_statuses,
        message: "Ticket cargado con éxito".to_string(),
    })
}

/// Requests an attachment's content, following redirects and only forwarding credentials to
/// the OpenProject host. Returns the successful response and its final URL.
async fn request_attachment(
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

#[tauri::command]
async fn fetch_attachment_content(
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
#[tauri::command]
async fn download_work_package_attachment(
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

#[tauri::command]
async fn fetch_openproject_projects(
    url: String,
    token: String,
) -> Result<Vec<OpenProjectProjectItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/projects?pageSize=100", clean_url);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(15)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let identifier = el["identifier"].as_str().map(|s| s.to_string());
                list.push(OpenProjectProjectItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    identifier,
                });
            }
        }
    }

    Ok(list)
}

fn parse_activity_schema(json_val: &serde_json::Value) -> Vec<TimeEntryActivityItem> {
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

#[tauri::command]
async fn fetch_time_entry_activities(
    url: String,
    token: String,
    ticket: Option<String>,
) -> Result<Vec<TimeEntryActivityItem>, String> {
    let clean_url = sanitize_url(&url);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let form_endpoint = format!("{}/api/v3/time_entries/form", clean_url);

    // 1. If ticket is provided, query POST /api/v3/time_entries/form with workPackage link
    let raw_ticket = ticket.as_deref().map(|t| t.trim().trim_start_matches('#')).filter(|s| !s.is_empty());
    if let Some(wp_id) = raw_ticket {
        let payload = serde_json::json!({
            "_links": {
                "workPackage": { "href": format!("/api/v3/work_packages/{}", wp_id) }
            }
        });
        if let Ok(res) = client
            .post(&form_endpoint)
            .header("Authorization", &auth_value)
            .header("Content-Type", "application/json")
            .header("Accept", "application/hal+json, application/json")
            .body(payload.to_string())
            .send()
            .await
        {
            if res.status().is_success() {
                if let Ok(json_val) = res.json::<serde_json::Value>().await {
                    let items = parse_activity_schema(&json_val);
                    if !items.is_empty() {
                        return Ok(items);
                    }
                }
            }
        }
    }

    // 2. Discover via GET /api/v3/work_packages?pageSize=1 to get user's accessible work package
    let wp_sample_endpoint = format!("{}/api/v3/work_packages?pageSize=1", clean_url);
    if let Ok(res) = client
        .get(&wp_sample_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json_val) = res.json::<serde_json::Value>().await {
                if let Some(elements) = json_val.get("_embedded").and_then(|e| e.get("elements")).and_then(|el| el.as_array()) {
                    if let Some(first) = elements.first() {
                        let sample_id = first.get("id").and_then(|id| id.as_i64()).map(|n| n.to_string())
                            .or_else(|| first.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()));
                        if let Some(wp_id) = sample_id {
                            let payload = serde_json::json!({
                                "_links": {
                                    "workPackage": { "href": format!("/api/v3/work_packages/{}", wp_id) }
                                }
                            });
                            if let Ok(form_res) = client
                                .post(&form_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/hal+json, application/json")
                                .body(payload.to_string())
                                .send()
                                .await
                            {
                                if form_res.status().is_success() {
                                    if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                                        let items = parse_activity_schema(&form_json);
                                        if !items.is_empty() {
                                            return Ok(items);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Discover via GET /api/v3/projects?pageSize=1
    let proj_sample_endpoint = format!("{}/api/v3/projects?pageSize=1", clean_url);
    if let Ok(res) = client
        .get(&proj_sample_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json_val) = res.json::<serde_json::Value>().await {
                if let Some(elements) = json_val.get("_embedded").and_then(|e| e.get("elements")).and_then(|el| el.as_array()) {
                    if let Some(first) = elements.first() {
                        let sample_id = first.get("id").and_then(|id| id.as_i64()).map(|n| n.to_string())
                            .or_else(|| first.get("id").and_then(|id| id.as_str()).map(|s| s.to_string()));
                        if let Some(pid) = sample_id {
                            let payload = serde_json::json!({
                                "_links": {
                                    "project": { "href": format!("/api/v3/projects/{}", pid) }
                                }
                            });
                            if let Ok(form_res) = client
                                .post(&form_endpoint)
                                .header("Authorization", &auth_value)
                                .header("Content-Type", "application/json")
                                .header("Accept", "application/hal+json, application/json")
                                .body(payload.to_string())
                                .send()
                                .await
                            {
                                if form_res.status().is_success() {
                                    if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                                        let items = parse_activity_schema(&form_json);
                                        if !items.is_empty() {
                                            return Ok(items);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. Try POST /api/v3/time_entries/form with empty body
    if let Ok(form_res) = client
        .post(&form_endpoint)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .body("{}")
        .send()
        .await
    {
        if form_res.status().is_success() {
            if let Ok(form_json) = form_res.json::<serde_json::Value>().await {
                let items = parse_activity_schema(&form_json);
                if !items.is_empty() {
                    return Ok(items);
                }
            }
        }
    }

    // 5. Fallback to GET /api/v3/time_entries/activities if form endpoint was unavailable
    let endpoint = format!("{}/api/v3/time_entries/activities", clean_url);
    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    let elements_opt = json_val["_embedded"]["elements"]
        .as_array()
        .or_else(|| json_val["elements"].as_array());

    if let Some(elements) = elements_opt {
        for el in elements {
            let id = if let Some(n) = el["id"].as_i64() {
                Some(n.to_string())
            } else if let Some(s) = el["id"].as_str() {
                Some(s.to_string())
            } else if let Some(href) = el["_links"]["self"]["href"].as_str() {
                href.split('/').filter(|s| !s.is_empty()).last().map(|s| s.to_string())
            } else {
                None
            };

            let name = if let Some(n) = el["name"].as_str() {
                Some(n.to_string())
            } else if let Some(t) = el["_links"]["self"]["title"].as_str() {
                Some(t.to_string())
            } else {
                None
            };

            if let (Some(id), Some(name)) = (id, name) {
                list.push(TimeEntryActivityItem {
                    id,
                    name,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn create_time_entry(
    url: String,
    token: String,
    ticket: String,
    minutes: i32,
    date: String,
    comment: String,
    activity_type_id: Option<String>,
    project_id: Option<String>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/time_entries", clean_url);
    let auth_value = build_auth_header(&token);

    let hours_float = (minutes as f64) / 60.0;
    let iso_duration = format!("PT{:.2}H", hours_float);

    let mut links = serde_json::json!({
        "workPackage": { "href": format!("/api/v3/work_packages/{}", raw_ticket) }
    });

    if let Some(pid) = project_id {
        if !pid.trim().is_empty() {
            links["project"] = serde_json::json!({ "href": format!("/api/v3/projects/{}", pid) });
        }
    }

    if let Some(aid) = activity_type_id {
        if !aid.trim().is_empty() {
            links["activity"] = serde_json::json!({ "href": format!("/api/v3/time_entries/activities/{}", aid) });
        }
    }

    let payload = serde_json::json!({
        "comment": { "format": "plain", "raw": comment },
        "spentOn": date,
        "hours": iso_duration,
        "_links": links
    });

    let client = build_http_client(15)?;

    let res = client
        .post(&endpoint)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error enviando tiempo a OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn update_work_package_status(
    url: String,
    token: String,
    ticket: String,
    status_id: String,
    lock_version: Option<i64>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let actual_lock_version = match lock_version {
        Some(lv) => lv,
        None => {
            let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
            let res = client
                .get(&wp_url)
                .header("Authorization", &auth_value)
                .header("Accept", "application/hal+json, application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let patch_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let payload = serde_json::json!({
        "lockVersion": actual_lock_version,
        "_links": {
            "status": {
                "href": format!("/api/v3/statuses/{}", status_id)
            }
        }
    });

    let res = client
        .patch(&patch_url)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error actualizando estado en OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn update_work_package_version(
    url: String,
    token: String,
    ticket: String,
    version_id: Option<String>,
    lock_version: Option<i64>,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let actual_lock_version = match lock_version {
        Some(lv) => lv,
        None => {
            let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
            let res = client
                .get(&wp_url)
                .header("Authorization", &auth_value)
                .header("Accept", "application/hal+json, application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            let val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let patch_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let version_href = match version_id {
        Some(vid) if !vid.trim().is_empty() => serde_json::json!({ "href": format!("/api/v3/versions/{}", vid) }),
        _ => serde_json::json!({ "href": null }),
    };

    let payload = serde_json::json!({
        "lockVersion": actual_lock_version,
        "_links": {
            "version": version_href
        }
    });

    let res = client
        .patch(&patch_url)
        .header("Authorization", auth_value)
        .header("Content-Type", "application/json")
        .header("Accept", "application/hal+json, application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if res.status().is_success() {
        Ok(())
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("Error actualizando versión en OpenProject: {}", err_text))
    }
}

#[tauri::command]
async fn fetch_project_versions(
    url: String,
    token: String,
    project_id: String,
) -> Result<Vec<VersionOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/projects/{}/versions", clean_url, project_id.trim());
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let status = el["status"].as_str().map(|s| s.to_string());
                list.push(VersionOptionItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    status,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn fetch_statuses(
    url: String,
    token: String,
) -> Result<Vec<StatusOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/statuses", clean_url);
    let auth_value = build_auth_header(&token);

    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for el in elements {
            if let (Some(id), Some(name)) = (el["id"].as_i64(), el["name"].as_str()) {
                let color = el["color"].as_str().map(|s| s.to_string());
                list.push(StatusOptionItem {
                    id: id.to_string(),
                    name: name.to_string(),
                    color,
                });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn fetch_project_boards(
    url: String,
    token: String,
    project_id: String,
    project_identifier: Option<String>,
) -> Result<Vec<BoardOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/grids", clean_url);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let json_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut list = Vec::new();

    if let Some(elements) = json_val["_embedded"]["elements"].as_array() {
        for g in elements {
            let scope = g["_links"]["scope"]["href"]
                .as_str()
                .or_else(|| g["_links"]["page"]["href"].as_str())
                .unwrap_or("");

            let is_board = scope.ends_with("/boards")
                || g["widgets"].as_array().map_or(false, |w| {
                    w.iter()
                        .any(|item| item["identifier"].as_str() == Some("work_package_query"))
                });

            // Exclude non-workflow grids like subtask hierarchy views (WBS)
            let is_subtask_view = g["options"]["attribute"].as_str() == Some("subtasks");
            if !is_board || is_subtask_view {
                continue;
            }

            let proj_href = g["_links"]["project"]["href"].as_str().unwrap_or("");
            let proj_id = proj_href.split('/').last().unwrap_or("");

            let pid = project_id.trim();
            let matches_project = (proj_id == pid || proj_href.ends_with(&format!("/{}", pid)))
                || scope.contains(&format!("/{}/", pid))
                || project_identifier.as_ref().map_or(false, |ident| {
                    !ident.is_empty() && scope.contains(&format!("/{}/", ident))
                });

            if matches_project {
                let id = g["id"].as_i64().map(|n| n.to_string()).unwrap_or_default();
                let name = g["name"]
                    .as_str()
                    .or_else(|| g["_links"]["scope"]["title"].as_str())
                    .or_else(|| g["_links"]["page"]["title"].as_str())
                    .unwrap_or("Board")
                    .to_string();

                list.push(BoardOptionItem { id, name });
            }
        }
    }

    Ok(list)
}

#[tauri::command]
async fn fetch_board_columns(
    url: String,
    token: String,
    grid_id: String,
) -> Result<Vec<BoardColumnOptionItem>, String> {
    let clean_url = sanitize_url(&url);
    let endpoint = format!("{}/api/v3/grids/{}", clean_url, grid_id.trim());
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let res = client
        .get(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Ok(Vec::new());
    }

    let grid_val: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let mut columns = Vec::new();

    if let Some(widgets) = grid_val["widgets"].as_array() {
        for widget in widgets {
            let widget_id = widget["id"].as_i64().unwrap_or(0);
            let start_column = widget["startColumn"].as_i64().unwrap_or(0);
            let query_id = widget["options"]["queryId"]
                .as_i64()
                .map(|n| n.to_string())
                .or_else(|| {
                    widget["options"]["queryId"]
                        .as_str()
                        .map(|s| s.to_string())
                });

            if let Some(qid) = query_id {
                let q_endpoint = format!("{}/api/v3/queries/{}", clean_url, qid);
                if let Ok(q_res) = client
                    .get(&q_endpoint)
                    .header("Authorization", &auth_value)
                    .header("Accept", "application/hal+json, application/json")
                    .send()
                    .await
                {
                    if q_res.status().is_success() {
                        if let Ok(q_val) = q_res.json::<serde_json::Value>().await {
                            let name = q_val["name"]
                                .as_str()
                                .unwrap_or(&format!("Columna {}", qid))
                                .to_string();

                            let mut wp_ids = Vec::new();
                            let mut wp_cards = Vec::new();
                            if let Some(elements) = q_val["_embedded"]["results"]["_embedded"]
                                ["elements"]
                                .as_array()
                            {
                                for el in elements {
                                    if let Some(id) = el["id"].as_i64() {
                                        wp_ids.push(id);
                                        let subject = el["subject"]
                                            .as_str()
                                            .unwrap_or("")
                                            .to_string();
                                        let type_name = el["_links"]["type"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let type_color = el["_embedded"]["type"]["color"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let wp_status_id = el["_links"]["status"]["href"]
                                            .as_str()
                                            .and_then(|h| h.split('/').last())
                                            .map(|s| s.to_string());
                                        let wp_status_name = el["_links"]["status"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let wp_status_color = el["_embedded"]["status"]["color"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let priority_name = el["_links"]["priority"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let assignee_name = el["_links"]["assignee"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let project_name = el["_links"]["project"]["title"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let start_date = el["startDate"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let due_date = el["dueDate"]
                                            .as_str()
                                            .map(|s| s.to_string());
                                        let lock_version = el["lockVersion"].as_i64();

                                        wp_cards.push(BoardWorkPackageCardItem {
                                            id,
                                            subject,
                                            type_name,
                                            type_color,
                                            status_id: wp_status_id,
                                            status_name: wp_status_name,
                                            status_color: wp_status_color,
                                            priority_name,
                                            assignee_name,
                                            project_name,
                                            start_date,
                                            due_date,
                                            lock_version,
                                        });
                                    }
                                }
                            }

                            let mut status_id = None;
                            let mut status_name = None;
                            if let Some(filters) = q_val["filters"].as_array() {
                                for f in filters {
                                    let href =
                                        f["_links"]["filter"]["href"].as_str().unwrap_or("");
                                    let fname = f["name"].as_str().unwrap_or("").to_lowercase();
                                    if href.ends_with("/status")
                                        || href.ends_with("/status_id")
                                        || fname == "status"
                                        || fname == "estado"
                                    {
                                        if let Some(val_obj) = f["_links"]["values"]
                                            .as_array()
                                            .and_then(|v| v.first())
                                        {
                                            if let Some(v_href) = val_obj["href"].as_str() {
                                                status_id = v_href
                                                    .split('/')
                                                    .last()
                                                    .map(|s| s.to_string());
                                                status_name = val_obj["title"]
                                                    .as_str()
                                                    .map(|s| s.to_string());
                                            }
                                        } else if let Some(first_val) =
                                            f["values"].as_array().and_then(|v| v.first())
                                        {
                                            status_id = first_val
                                                .as_str()
                                                .map(|s| s.to_string())
                                                .or_else(|| first_val.as_i64().map(|n| n.to_string()));
                                        }
                                        break;
                                    }
                                }
                            }

                            columns.push(BoardColumnOptionItem {
                                query_id: qid,
                                name,
                                widget_id,
                                start_column,
                                work_package_ids: wp_ids,
                                work_packages: wp_cards,
                                status_id,
                                status_name,
                            });
                        }
                    }
                }
            }
        }
    }

    columns.sort_by_key(|c| c.start_column);
    Ok(columns)
}

fn build_query_order_delta(
    ticket_id: i64,
    order_map: &serde_json::Map<String, serde_json::Value>,
    target_position_index: Option<usize>,
    target_ticket_ids: Option<&[i64]>,
) -> serde_json::Map<String, serde_json::Value> {
    const ORDER_GAP: i64 = 8192;

    let mut ordered_entries: Vec<(i64, i64)> = order_map
        .iter()
        .filter_map(|(id, position)| {
            let id = id.parse::<i64>().ok()?;
            let position = position.as_i64()?;
            (id != ticket_id).then_some((id, position))
        })
        .collect();
    ordered_entries.sort_by_key(|(id, position)| (*position, *id));

    let Some(target_position_index) = target_position_index else {
        let position = ordered_entries
            .iter()
            .map(|(_, position)| *position)
            .min()
            .map(|position| position.saturating_sub(ORDER_GAP))
            .unwrap_or(0);
        return serde_json::Map::from_iter([(
            ticket_id.to_string(),
            serde_json::Value::from(position),
        )]);
    };

    let mut target_ids = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();
    for id in target_ticket_ids.unwrap_or_default() {
        if *id > 0 && *id != ticket_id && seen_ids.insert(*id) {
            target_ids.push(*id);
        }
    }
    let target_index = target_position_index.min(target_ids.len());
    let previous_id = target_index.checked_sub(1).and_then(|index| target_ids.get(index));
    let next_id = target_ids.get(target_index);
    let mut ordered_ids: Vec<i64> = ordered_entries.iter().map(|(id, _)| *id).collect();

    for (index, id) in target_ids.iter().enumerate() {
        if ordered_ids.contains(id) {
            continue;
        }
        let next_known_index = target_ids[index + 1..]
            .iter()
            .find_map(|candidate| ordered_ids.iter().position(|ordered_id| ordered_id == candidate));
        if let Some(position) = next_known_index {
            ordered_ids.insert(position, *id);
            continue;
        }
        let previous_known_index = target_ids[..index]
            .iter()
            .rev()
            .find_map(|candidate| ordered_ids.iter().position(|ordered_id| ordered_id == candidate));
        if let Some(position) = previous_known_index {
            ordered_ids.insert(position + 1, *id);
            continue;
        }
        ordered_ids.insert(index.min(ordered_ids.len()), *id);
    }

    let next_index = next_id.and_then(|id| ordered_ids.iter().position(|ordered_id| ordered_id == id));
    let previous_index = previous_id.and_then(|id| ordered_ids.iter().position(|ordered_id| ordered_id == id));
    let insertion_index = next_index
        .or_else(|| previous_index.map(|index| index + 1))
        .unwrap_or_else(|| target_index.min(ordered_ids.len()));

    let position_for = |id: Option<&i64>| {
        id.and_then(|id| ordered_entries.iter().find(|(ordered_id, _)| ordered_id == id))
            .map(|(_, position)| *position)
    };
    let previous_position = insertion_index
        .checked_sub(1)
        .and_then(|index| ordered_ids.get(index))
        .and_then(|id| position_for(Some(id)));
    let next_position = ordered_ids
        .get(insertion_index)
        .and_then(|id| position_for(Some(id)));

    if let (Some(previous), Some(next)) = (previous_position, next_position) {
        if next.saturating_sub(previous) > 1 {
            let position = previous.saturating_add(next.saturating_sub(previous) / 2);
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(position),
            )]);
        }
    } else if let Some(previous) = previous_position {
        if insertion_index == ordered_ids.len() {
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(previous.saturating_add(ORDER_GAP)),
            )]);
        }
    } else if let Some(next) = next_position {
        if insertion_index == 0 {
            return serde_json::Map::from_iter([(
                ticket_id.to_string(),
                serde_json::Value::from(next.saturating_sub(ORDER_GAP)),
            )]);
        }
    } else if ordered_ids.is_empty() {
        return serde_json::Map::from_iter([(
            ticket_id.to_string(),
            serde_json::Value::from(0),
        )]);
    }

    ordered_ids.insert(insertion_index, ticket_id);
    serde_json::Map::from_iter(ordered_ids.iter().enumerate().map(|(index, id)| {
        (
            id.to_string(),
            serde_json::Value::from((index as i64).saturating_mul(ORDER_GAP)),
        )
    }))
}

#[tauri::command]
async fn move_work_package_to_board_column(
    url: String,
    token: String,
    ticket: String,
    target_query_id: String,
    source_query_id: Option<String>,
    target_status_id: Option<String>,
    target_position_index: Option<usize>,
    target_ticket_ids: Option<Vec<i64>>,
    expected_lock_version: Option<i64>,
) -> Result<MoveColumnResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let same_query = source_query_id.as_deref() == Some(target_query_id.as_str());
    let ticket_num = raw_ticket
        .parse::<i64>()
        .map_err(|_| "Ticket ID inválido".to_string())?;
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let wp_url = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let snapshot_response = client
        .get(&wp_url)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !snapshot_response.status().is_success() {
        return Ok(MoveColumnResult {
            ok: false,
            status_id: None,
            error: Some(format!("No se pudo validar el ticket (HTTP {})", snapshot_response.status())),
        });
    }
    let snapshot: serde_json::Value = snapshot_response.json().await.map_err(|error| error.to_string())?;
    let current_lock_version = snapshot["lockVersion"].as_i64().unwrap_or(0);
    if expected_lock_version.is_some_and(|expected| expected != current_lock_version) {
        return Ok(MoveColumnResult {
            ok: false,
            status_id: None,
            error: Some(format!(
                "WORK_PACKAGE_CONFLICT: el ticket cambió en OpenProject (versión actual {}). Recarga antes de moverlo.",
                current_lock_version
            )),
        });
    }

    // 1. Determine target status
    let mut resolved_status_id = target_status_id;
    if resolved_status_id.is_none() {
        let q_url = format!("{}/api/v3/queries/{}", clean_url, target_query_id);
        if let Ok(res) = client
            .get(&q_url)
            .header("Authorization", &auth_value)
            .send()
            .await
        {
            if let Ok(q_val) = res.json::<serde_json::Value>().await {
                if let Some(filters) = q_val["filters"].as_array() {
                    for f in filters {
                        let href = f["_links"]["filter"]["href"].as_str().unwrap_or("");
                        let fname = f["name"].as_str().unwrap_or("").to_lowercase();
                        if href.ends_with("/status")
                            || href.ends_with("/status_id")
                            || fname == "status"
                            || fname == "estado"
                        {
                            if let Some(val_obj) =
                                f["_links"]["values"].as_array().and_then(|v| v.first())
                            {
                                resolved_status_id = val_obj["href"]
                                    .as_str()
                                    .and_then(|h| h.split('/').last())
                                    .map(|s| s.to_string());
                            } else if let Some(fv) = f["values"].as_array().and_then(|v| v.first())
                            {
                                resolved_status_id = fv
                                    .as_str()
                                    .map(|s| s.to_string())
                                    .or_else(|| fv.as_i64().map(|n| n.to_string()));
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    // 2. Update Work Package status only when the drop changes columns
    let mut status_was_updated = false;
    if !same_query {
        if let Some(ref sid) = resolved_status_id {
            let patch_body = serde_json::json!({
                "lockVersion": current_lock_version,
                "_links": {
                    "status": { "href": format!("/api/v3/statuses/{}", sid) }
                }
            });
            let status_res = client
                .patch(&wp_url)
                .header("Authorization", &auth_value)
                .header("Content-Type", "application/json")
                .json(&patch_body)
                .send()
                .await
                .map_err(|e| format!("Error actualizando estado: {}", e))?;

            if !status_res.status().is_success() {
                let error = status_res.text().await.unwrap_or_default();
                return Ok(MoveColumnResult {
                    ok: false,
                    status_id: resolved_status_id.clone(),
                    error: Some(format!("Error actualizando estado en OpenProject: {}", error)),
                });
            }
            status_was_updated = true;
        }
    }

    // 3. Remove from source query order if different
    if let Some(ref sqid) = source_query_id {
        if sqid != &target_query_id && !sqid.is_empty() {
            let src_order_url = format!("{}/api/v3/queries/{}/order", clean_url, sqid);
            let remove_body = serde_json::json!({
                "delta": { ticket_num.to_string(): -1 }
            });
            let _ = client
                .patch(&src_order_url)
                .header("Authorization", &auth_value)
                .header("Content-Type", "application/json")
                .json(&remove_body)
                .send()
                .await;
        }
    }

    // 4. Persist the requested visual position. Calls without a drop index retain first-position behavior.
    let target_order_url = format!("{}/api/v3/queries/{}/order", clean_url, target_query_id);
    let mut order_map = serde_json::Map::new();
    let order_response = client
        .get(&target_order_url)
        .header("Authorization", &auth_value)
        .header("Accept", "application/json")
        .send()
        .await;

    match order_response {
        Ok(response) if response.status().is_success() => {
            match response.json::<serde_json::Map<String, serde_json::Value>>().await {
                Ok(map) => order_map = map,
                Err(error) if target_position_index.is_some() => {
                    return Ok(MoveColumnResult {
                        ok: false,
                        status_id: resolved_status_id,
                        error: Some(format!("Error leyendo el orden de la columna: {}", error)),
                    });
                }
                Err(_) => {}
            }
        }
        Ok(response) if target_position_index.is_some() => {
            let error = response.text().await.unwrap_or_default();
            return Ok(MoveColumnResult {
                ok: false,
                status_id: resolved_status_id,
                error: Some(format!("Error leyendo el orden de la columna: {}", error)),
            });
        }
        Err(error) if target_position_index.is_some() => {
            return Ok(MoveColumnResult {
                ok: false,
                status_id: resolved_status_id,
                error: Some(format!("Error leyendo el orden de la columna: {}", error)),
            });
        }
        _ => {}
    }

    let order_delta = build_query_order_delta(
        ticket_num,
        &order_map,
        target_position_index,
        target_ticket_ids.as_deref(),
    );
    let target_body = serde_json::json!({ "delta": order_delta });
    let target_res = client
        .patch(&target_order_url)
        .header("Authorization", &auth_value)
        .header("Content-Type", "application/json")
        .json(&target_body)
        .send()
        .await
        .map_err(|e| format!("Error en conexión: {}", e))?;

    if target_res.status().is_success() {
        Ok(MoveColumnResult {
            ok: true,
            status_id: resolved_status_id,
            error: None,
        })
    } else if status_was_updated {
        Ok(MoveColumnResult {
            ok: true,
            status_id: resolved_status_id,
            error: None,
        })
    } else {
        let err_text = target_res.text().await.unwrap_or_default();
        Ok(MoveColumnResult {
            ok: false,
            status_id: resolved_status_id,
            error: Some(format!("Error en OpenProject: {}", err_text)),
        })
    }
}

#[tauri::command]
fn exit_app(app: AppHandle) {
    ipc::cleanup_ipc_file(&app);
    app.exit(0);
}

fn parse_allowed_value_items(list: &[serde_json::Value]) -> Vec<WorkPackageOptionItem> {
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

fn parse_schema_allowed_values(schema_field: &serde_json::Value) -> Vec<WorkPackageOptionItem> {
    let list = schema_field["_embedded"]["allowedValues"]
        .as_array()
        .or_else(|| schema_field["allowedValues"].as_array())
        .or_else(|| schema_field["_embedded"]["elements"].as_array())
        .or_else(|| schema_field["elements"].as_array())
        .or_else(|| schema_field["_links"]["allowedValues"].as_array());
    list.map(|values| parse_allowed_value_items(values))
        .unwrap_or_default()
}

async fn fetch_schema_allowed_values(
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

async fn fetch_available_people(
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

#[tauri::command]
async fn fetch_work_package_revisions(
    url: String,
    token: String,
    ticket_ids: Vec<String>,
) -> Result<Vec<WorkPackageRevisionItem>, String> {
    let clean_url = sanitize_url(&url);
    let ticket_ids: Vec<String> = ticket_ids
        .into_iter()
        .map(|ticket| ticket.trim().trim_start_matches('#').to_string())
        .filter(|ticket| !ticket.is_empty() && ticket.chars().all(|character| character.is_ascii_digit()))
        .collect();
    if ticket_ids.is_empty() {
        return Ok(Vec::new());
    }

    let endpoint = format!("{}/api/v3/work_packages", clean_url);
    let page_size = ticket_ids.len().to_string();
    let filters = serde_json::json!([{
        "id": { "operator": "=", "values": ticket_ids }
    }])
    .to_string();
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;
    let response = client
        .get(&endpoint)
        .query(&[
            ("filters", filters.as_str()),
            ("offset", "1"),
            ("pageSize", page_size.as_str()),
            ("valid_subset", "true"),
        ])
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(data["_embedded"]["elements"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|work_package| {
            let id = work_package["id"]
                .as_i64()
                .map(|id| id.to_string())
                .or_else(|| work_package["id"].as_str().map(|id| id.to_string()))?;
            let lock_version = work_package["lockVersion"].as_i64()?;
            Some(WorkPackageRevisionItem {
                id,
                lock_version,
                updated_at: work_package["updatedAt"].as_str().map(|value| value.to_string()),
            })
        })
        .collect())
}

#[tauri::command]
async fn fetch_work_package_update_stream(
    url: String,
    token: String,
    ticket: String,
    last_update_timestamp: String,
) -> Result<WorkPackageUpdateStreamResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!(
        "{}/work_packages/{}/activities/update_streams",
        clean_url, raw_ticket
    );
    let auth_value = build_auth_header(&token);
    let client = build_http_client(12)?;

    let response = match client
        .get(&endpoint)
        .query(&[
            ("sortBy", "asc"),
            ("filter", "all"),
            ("last_update_timestamp", last_update_timestamp.as_str()),
        ])
        .header("Authorization", &auth_value)
        .header("Accept", "text/vnd.turbo-stream.html, */*")
        .header("X-Requested-With", "XMLHttpRequest")
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => {
            return Ok(WorkPackageUpdateStreamResult {
                available: false,
                has_updates: false,
            });
        }
    };

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body = response.text().await.unwrap_or_default();
    let available = content_type.contains("turbo-stream") || body.contains("<turbo-stream");

    Ok(WorkPackageUpdateStreamResult {
        available,
        has_updates: available && body.contains("<turbo-stream"),
    })
}

#[tauri::command]
async fn fetch_work_package_form(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageFormSchemaResult, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}/form", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let mut assignees =
        fetch_available_people(&client, &clean_url, &auth_value, raw_ticket, "assignees").await;
    let mut responsibles =
        fetch_available_people(&client, &clean_url, &auth_value, raw_ticket, "responsibles").await;

    let form_val: serde_json::Value = match client
        .post(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}))
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => {
            response.json().await.unwrap_or(serde_json::Value::Null)
        }
        _ => serde_json::Value::Null,
    };
    let schema = &form_val["_embedded"]["schema"];

    if assignees.is_empty() {
        assignees = fetch_schema_allowed_values(
            &schema["assignee"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await;
    }
    if responsibles.is_empty() {
        responsibles = fetch_schema_allowed_values(
            &schema["responsible"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await;
    }
    if responsibles.is_empty() {
        responsibles = assignees.clone();
    }

    Ok(WorkPackageFormSchemaResult {
        statuses: fetch_schema_allowed_values(&schema["status"], &client, &clean_url, &auth_value)
            .await,
        priorities: fetch_schema_allowed_values(
            &schema["priority"],
            &client,
            &clean_url,
            &auth_value,
        )
        .await,
        assignees,
        responsibles,
        versions: fetch_schema_allowed_values(&schema["version"], &client, &clean_url, &auth_value)
            .await,
    })
}

#[tauri::command]
async fn update_work_package(
    url: String,
    token: String,
    ticket: String,
    payload: UpdateWorkPackagePayload,
) -> Result<i64, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let wp_endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let lock_version = match payload.lock_version {
        Some(lv) => lv,
        None => {
            let wp_res = client
                .get(&wp_endpoint)
                .header("Authorization", &auth_value)
                .header("Accept", "application/hal+json, application/json")
                .send()
                .await
                .map_err(|e| e.to_string())?;
            if !wp_res.status().is_success() {
                return Err(format!("HTTP {}", wp_res.status()));
            }
            let wp_val: serde_json::Value = wp_res.json().await.map_err(|e| e.to_string())?;
            wp_val["lockVersion"].as_i64().unwrap_or(0)
        }
    };

    let mut body = serde_json::Map::new();
    body.insert("lockVersion".to_string(), serde_json::json!(lock_version));

    if let Some(subject) = payload.subject {
        body.insert("subject".to_string(), serde_json::json!(subject));
    }
    if let Some(desc) = payload.description_raw {
        body.insert(
            "description".to_string(),
            serde_json::json!({ "format": "markdown", "raw": desc }),
        );
    }
    if payload.clear_start_date.unwrap_or(false) {
        body.insert("startDate".to_string(), serde_json::Value::Null);
    } else if let Some(sd) = payload.start_date {
        body.insert("startDate".to_string(), serde_json::json!(sd));
    }
    if payload.clear_due_date.unwrap_or(false) {
        body.insert("dueDate".to_string(), serde_json::Value::Null);
    } else if let Some(dd) = payload.due_date {
        body.insert("dueDate".to_string(), serde_json::json!(dd));
    }
    if let Some(est) = payload.estimated_time {
        body.insert("estimatedTime".to_string(), serde_json::json!(est));
    }

    let mut links = serde_json::Map::new();
    if let Some(sid) = payload.status_id {
        links.insert("status".to_string(), serde_json::json!({ "href": format!("/api/v3/statuses/{}", sid) }));
    }
    if let Some(pid) = payload.priority_id {
        links.insert("priority".to_string(), serde_json::json!({ "href": format!("/api/v3/priorities/{}", pid) }));
    }
    if payload.clear_assignee.unwrap_or(false) {
        links.insert("assignee".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(aid) = payload.assignee_id {
        links.insert("assignee".to_string(), serde_json::json!({ "href": format!("/api/v3/users/{}", aid) }));
    }
    if payload.clear_responsible.unwrap_or(false) {
        links.insert("responsible".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(rid) = payload.responsible_id {
        links.insert("responsible".to_string(), serde_json::json!({ "href": format!("/api/v3/users/{}", rid) }));
    }
    if payload.clear_version.unwrap_or(false) {
        links.insert("version".to_string(), serde_json::json!({ "href": serde_json::Value::Null }));
    } else if let Some(vid) = payload.version_id {
        links.insert("version".to_string(), serde_json::json!({ "href": format!("/api/v3/versions/{}", vid) }));
    }

    if !links.is_empty() {
        body.insert("_links".to_string(), serde_json::Value::Object(links));
    }

    let patch_res = client
        .patch(&wp_endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::Value::Object(body))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !patch_res.status().is_success() {
        let status = patch_res.status();
        let err_text = patch_res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, err_text));
    }

    let updated: serde_json::Value = patch_res.json().await.map_err(|e| e.to_string())?;
    Ok(updated["lockVersion"].as_i64().unwrap_or(lock_version + 1))
}

#[tauri::command]
async fn add_work_package_comment(
    url: String,
    token: String,
    ticket: String,
    comment: String,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}/activities", clean_url, raw_ticket);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;

    let res = client
        .post(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "comment": {
                "format": "markdown",
                "raw": comment
            }
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, err_text));
    }

    Ok(())
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadedAttachment {
    pub id: String,
    pub file_name: String,
    pub content_type: String,
    pub download_url: String,
}

#[tauri::command]
async fn upload_work_package_attachment(
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

#[tauri::command]
async fn fetch_work_package_cost_summary(
    url: String,
    token: String,
    ticket: String,
) -> Result<WorkPackageCostSummaryItem, String> {
    let clean_url = sanitize_url(&url);
    let raw_ticket = ticket.trim().trim_start_matches('#');
    let endpoint = format!("{}/api/v3/work_packages/{}", clean_url, raw_ticket);
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
        return Ok(WorkPackageCostSummaryItem::default());
    }
    let data: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    Ok(WorkPackageCostSummaryItem {
        labor_costs: data["laborCosts"].as_str().map(|value| value.to_string()),
        material_costs: data["materialCosts"].as_str().map(|value| value.to_string()),
        overall_costs: data["overallCosts"].as_str().map(|value| value.to_string()),
    })
}

#[tauri::command]
async fn fetch_current_user_id(url: String, token: String) -> Result<String, String> {
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

#[tauri::command]
async fn update_work_package_time_entry(
    url: String,
    token: String,
    entry_id: String,
    payload: UpdateTimeEntryPayload,
) -> Result<(), String> {
    let clean_url = sanitize_url(&url);
    let raw_entry_id = entry_id.trim();
    let endpoint = format!("{}/api/v3/time_entries/{}", clean_url, raw_entry_id);
    let auth_value = build_auth_header(&token);
    let client = build_http_client(15)?;
    let mut body = serde_json::json!({
        "hours": payload.hours,
        "spentOn": payload.spent_on,
        "comment": { "format": "plain", "raw": payload.comment }
    });
    if let Some(activity_id) = payload.activity_id {
        body["_links"]["activity"] =
            serde_json::json!({ "href": format!("/api/v3/time_entries/activities/{}", activity_id) });
    }
    let response = client
        .patch(&endpoint)
        .header("Authorization", &auth_value)
        .header("Accept", "application/hal+json, application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        let status = response.status();
        let message = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, message));
    }
    Ok(())
}

async fn fetch_work_package_descendant_ids(
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

fn parse_platform_time_entry(el: &serde_json::Value) -> Option<PlatformTimeEntryItem> {
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

async fn load_time_cost_report_entries(
    url: String,
    token: String,
    filter: TimeCostReportFilter,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    let clean_url = sanitize_url(&url);
    let auth_value = build_auth_header(&token);
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
    if let Some(spent_on_from) = filter.spent_on_from.as_deref().filter(|value| !value.trim().is_empty()) {
        filters.push(serde_json::json!({ "spent_on": { "operator": ">=", "values": [spent_on_from] } }));
    }
    if let Some(spent_on_to) = filter.spent_on_to.as_deref().filter(|value| !value.trim().is_empty()) {
        filters.push(serde_json::json!({ "spent_on": { "operator": "<=", "values": [spent_on_to] } }));
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
            return Ok(Vec::new());
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

#[tauri::command]
async fn fetch_time_cost_report_entries(
    url: String,
    token: String,
    filter: TimeCostReportFilter,
) -> Result<Vec<PlatformTimeEntryItem>, String> {
    load_time_cost_report_entries(url, token, filter).await
}

#[tauri::command]
async fn fetch_work_package_time_entries(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let handle = app.handle();

            // Iniciar servidor local IPC para comunicación en tiempo real con PocketProject MCP
            if let Err(e) = ipc::start_ipc_server(handle.clone()) {
                eprintln!("[PocketProject IPC] Failed to start local server: {}", e);
            }

            // Habilitar inicio automático con el sistema operativo
            let autostart_manager = app.autolaunch();
            let _ = autostart_manager.enable();

            // Si se inicia en el arranque con --minimized, ocultar ventana
            let args: Vec<String> = std::env::args().collect();
            if args.iter().any(|arg| arg == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }

            let show_item = MenuItem::with_id(handle, "show", "Abrir PocketProject", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(handle, "quit", "Salir", true, None::<&str>)?;
            let tray_menu = Menu::with_items(handle, &[&show_item, &quit_item])?;

            let mut builder = TrayIconBuilder::new()
                .menu(&tray_menu)
                .tooltip("PocketProject")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.unminimize();
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            ipc::cleanup_ipc_file(app);
                            app.exit(0);
                        }
                        _ => {}
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            let _tray = builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("close-requested", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_app_config,
            save_app_config,
            check_is_configured,
            test_openproject_connection,
            get_activities,
            save_activity,
            delete_activity,
            clear_activities,
            fetch_ticket_info,
            fetch_ticket_context,
            fetch_attachment_content,
            download_work_package_attachment,
            fetch_openproject_projects,
            fetch_time_entry_activities,
            create_time_entry,
            update_work_package_status,
            update_work_package_version,
            fetch_project_versions,
            fetch_statuses,
            fetch_project_boards,
            fetch_board_columns,
            move_work_package_to_board_column,
            fetch_work_package_form,
            fetch_work_package_revisions,
            fetch_work_package_update_stream,
            update_work_package,
            add_work_package_comment,
            upload_work_package_attachment,
            fetch_work_package_cost_summary,
            fetch_current_user_id,
            update_work_package_time_entry,
            fetch_time_cost_report_entries,
            fetch_work_package_time_entries,
            get_database_path,
            get_ai_stats,
            get_favorite_tickets,
            save_favorite_ticket,
            delete_favorite_ticket,
            install_mcp_to_client,
            inject_ai_rules,
            exit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
