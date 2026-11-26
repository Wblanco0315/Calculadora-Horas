//! PocketProject MCP server installation into AI clients and AI rules injection.

use std::path::PathBuf;

use crate::model::mcp::McpInstallResult;

pub(crate) fn install_mcp_to_client(client: String) -> Result<McpInstallResult, String> {
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

pub(crate) fn inject_ai_rules() -> Result<McpInstallResult, String> {
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
