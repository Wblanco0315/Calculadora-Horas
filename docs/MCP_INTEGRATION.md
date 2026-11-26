# Integración de PocketProject con Agentes de IA vía MCP

PocketProject incluye un servidor oficial compatible con **Model Context Protocol (MCP)** distribuido en npm como [`pocketproject-mcp`](https://www.npmjs.com/package/pocketproject-mcp) y ubicado en su propio repositorio hermano en `../pocketproject-mcp/`. 

Permite que asistentes de IA locales y remotos (**Antigravity**, **Cursor**, **Claude Code**, **Claude Desktop** o **Windsurf**) interactúen directamente con:
1. La base de datos local SQLite de PocketProject.
2. La API REST en vivo de OpenProject (para resolución de tickets, estados, asignados y prioridades).
3. La interfaz gráfica en tiempo real: los cambios hechos por la IA se reflejan de forma instantánea en la app de escritorio vía eventos de Tauri (`db-changed`).

---

## 1. Instalación Rápida Automática (Recomendada)

Ejecuta el asistente de instalación en tu terminal:

```bash
npx pocketproject-mcp setup
```

Este comando detectará y configurará automáticamente:
- **Antigravity** (`~/.gemini/config/mcp_config.json`)
- **Cursor** (`.cursor/mcp.json`)
- **Claude Desktop** (`claude_desktop_config.json`)

---

## 2. Configuración Manual por Cliente

### En Antigravity
```bash
agy mcp add pocketproject -- npx -y pocketproject-mcp
```

O en `~/.gemini/config/mcp_config.json`:
```json
{
  "mcpServers": {
    "pocketproject": {
      "command": "npx",
      "args": ["-y", "pocketproject-mcp"]
    }
  }
}
```

### En Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "pocketproject": {
      "command": "npx",
      "args": ["-y", "pocketproject-mcp"]
    }
  }
}
```

### En Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "pocketproject": {
      "command": "npx",
      "args": ["-y", "pocketproject-mcp"]
    }
  }
}
```

---

## 3. Herramientas MCP Disponibles

| Herramienta | Parámetros | Descripción |
| :--- | :--- | :--- |
| `get_today_summary` | Ninguno | Retorna el balance de la jornada de hoy: horas registradas, objetivo diario, minutos pendientes y lista de tareas. |
| `get_ticket_context` | `ticket` (req), `include_description` (opc, def: `true`), `include_comments` (opc, def: `false`), `include_attachments` (opc, def: `false`), `include_time_entries` (opc, def: `false`) | Resolución del ticket con descripción completa por defecto. Opcionalmente comentarios, metadatos de archivos y time entries. |
| `get_ticket_attachment` | `download_url` (req) | Descarga el contenido (base64/data URL) de un archivo adjunto o imagen del ticket. (Requiere permiso explícito del usuario). |
| `search_activities` | `ticket`, `query`, `date_from`, `date_to`, `limit` | Búsqueda profunda en el historial de actividades y time entries acumuladas. |
| `get_activities` | `date` (opcional `YYYY-MM-DD`), `limit` | Lista las actividades registradas en la fecha indicada (por defecto hoy). |
| `search_tickets` | `query` (número o palabra clave) | Busca coincidencias en favoritos, historial local y en vivo en OpenProject. |
| `get_favorite_tickets` | Ninguno | Retorna todos los tickets favoritos guardados por el usuario. |
| `add_favorite_ticket` | `ticket`, `title`, `project_id`, `project_name` | Guarda un ticket en la lista de favoritos de SQLite. |
| `add_activity` | `name`, `minutes`, `ticket`, `ticket_title`, `project_name`, `date` | Registra una actividad. Si se indica `ticket`, autocompleta con datos oficiales de OpenProject/Favoritos. |
| `edit_activity` | `id`, `name`, `minutes`, `ticket`, `ticket_title`, `project_name`, `date` | Actualiza una actividad existente en la base de datos local. |
| `start_timer` | `ticket`, `ticket_title`, `name`, `project_name` | Pausa cronómetros previos e inicia un nuevo cronómetro en tiempo real con `created_by_ai = 1`. |
| `stop_timer` | `id` (opcional) | Detiene el cronómetro activo y consolida los minutos trabajados. |
| `get_openproject_context` | Ninguno | Proporciona el contexto de OpenProject (nombre de usuario, URL base, conteo de favoritos). |
| `get_user_info` | Ninguno | Obtiene el perfil completo del usuario autenticado en OpenProject (ID, nombre, correo, login, admin, horario). |
| `get_projects` | `query`, `active`, `limit` | Lista y busca proyectos accesibles en OpenProject con ID, nombre, slug y jerarquía. |
| `get_statuses` | Ninguno | Retorna la lista oficial de estados disponibles en OpenProject (ID, nombre, color hexadecimal). |
| `get_time_cost_report` | `ticket`, `project_id`, `user_id`, `activity_id`, `date_from`, `date_to`, `include_descendants`, `group_by` | Consulta entradas de tiempo con filtros equivalentes a la página de informes, incluye paquetes hijos y agrupa por fecha/usuario/actividad/proyecto/ticket. Devuelve totales de costo del paquete cuando OpenProject los permite; la API no expone costo monetario por entrada. |
| `update_ticket_status` | `ticket` (req), `status_id` (req), `lock_version` (req) | Actualiza el estado de un ticket en OpenProject con soporte de concurrencia optimista. |
| `get_project_boards` | `project_id` (req), `project_identifier` (opc) | Lista los tableros Kanban / de acción disponibles en el proyecto indicado. |
| `get_board_columns` | `board_id` (req) | Retorna las columnas del tablero seleccionado con sus queries, estados asignados y tickets contenidos. |
| `move_ticket_column` | `ticket` (req), `target_query_id` (req), `source_query_id` (opc), `target_status_id` (opc) | Desplaza un ticket a otra columna del tablero, ajustando su posición y sincronizando su estado en OpenProject. |

---

## 4. System Prompt (fuente única)

El system prompt de los agentes existe en **un solo lugar**: [`src-tauri/resources/mcp/system-prompt.md`](../src-tauri/resources/mcp/system-prompt.md). No se copia en el frontend, en el paquete MCP ni en esta documentación.

- El backend lo embebe en el binario (`include_str!`, `service/mcp_contract.rs`) y lo expone con el comando `get_mcp_contract`.
- La pantalla MCP del setup lo muestra y lo copia desde ese comando.
- `inject_ai_rules` pide la carpeta del proyecto y escribe el prompt en su `.agents/RULES.md`, `.cursorrules` o `AGENTS.md`, entre los marcadores `<!-- POCKETPROJECT MCP RULES START rules-version: <hash> -->` y `<!-- POCKETPROJECT MCP RULES END -->`. Si ya hay un bloque (aunque sea de una versión anterior) lo reemplaza en lugar de duplicarlo.
- `pocketproject-mcp` lo sirve como prompt MCP `pocketproject_rules`, leyéndolo de `mcp-contract.json`.

### Cómo llega siempre actualizado a todos los agentes

1. **Instrucciones del servidor MCP (vía principal)**: al iniciar, `pocketproject-mcp` envía el prompt de la app como `instructions` en la respuesta de `initialize`. Los clientes que soportan instrucciones de servidor (p. ej. Claude Code) lo añaden solos al contexto del agente, así que cada sesión nueva recibe el prompt de la versión instalada de la app. Si hay un problema de compatibilidad, se añade un aviso al final.
2. **Archivos de reglas de los proyectos**: cada archivo donde se inyectan las reglas queda registrado en `mcp-rules-targets.json` (directorio de datos de la app). En cada arranque la app reemplaza los bloques cuyo `rules-version` no coincide con el prompt actual (`refresh_registered_rules`); los archivos borrados o sin bloque se quitan del registro. Las reglas inyectadas antes del registro (en el directorio de trabajo de la app) se registran solas.
3. **Prompt MCP `pocketproject_rules`**: para clientes que no leen instrucciones de servidor; siempre devuelve el prompt actual.

Para cambiar las reglas basta con editar `system-prompt.md` y publicar una versión de la app: no hace falta publicar el MCP.
- `rulesVersion` es un hash del contenido, así que cualquier cambio del prompt marca automáticamente como desactualizadas las reglas inyectadas.

---

## 5. Sistema de Compatibilidad App ↔ MCP

```
PocketProject (app)                         pocketproject-mcp
───────────────────                         ─────────────────
al iniciar escribe  mcp-contract.json  ───►  lee el contrato
  appVersion, protocolVersion,               compara protocolVersion y minMcpVersion
  minMcpVersion, packageSpec,                sirve `rules` como prompt pocketproject_rules
  rulesVersion, rules                        tool get_compatibility
                                     ◄───   escribe mcp-runtime.json (mcpVersion, protocolVersion)
panel "Compatibilidad MCP"           ◄───   POST /notify { event: "mcp_hello" }
GET /ping devuelve version, protocolVersion, minMcpVersion, rulesVersion
```

Ambos archivos viven en el directorio de datos de la app, junto a `ipc.json` (`%APPDATA%\com.dev.wilsonblanco` en Windows).

| Constante | Dónde | Cuándo cambiarla |
|---|---|---|
| `MCP_PROTOCOL_VERSION` | `src-tauri/src/service/mcp_contract.rs` y `pocketproject-mcp/src/config/app-contract.ts` | Cambio incompatible del esquema SQLite, de los endpoints IPC o de la semántica de las herramientas. Se sube en los dos proyectos a la vez. |
| `MIN_MCP_VERSION` | `mcp_contract.rs` | Primera versión publicada del MCP que implementa el protocolo actual. |
| `MCP_PACKAGE_SPEC` | `mcp_contract.rs` | Rango npm escrito en la configuración de los clientes (`pocketproject-mcp@1`). Con un rango de versión mayor, `npx` descarga la versión compatible más nueva en cada arranque del cliente. Se cambia al publicar una versión mayor nueva. |
| `rulesVersion` | calculado (hash del prompt) | Nunca a mano. |

Resultado de la comprobación (`compatible` / `reason`):
- `protocol_mismatch`: la app y el MCP implementan protocolos distintos.
- `mcp_outdated`: el MCP es anterior a `minMcpVersion`.
- `app_not_found` (solo en el MCP): la app no ha publicado el contrato (no está instalada o es una versión anterior).

El panel **Compatibilidad MCP** (setup → MCP y Configuración → Sistema) muestra la versión de la app y del protocolo, el último MCP que arrancó, cada cliente configurado (actualizado si usa el `packageSpec` vigente) y cada archivo de reglas registrado. **Actualizar todo** reescribe las configuraciones de cliente desactualizadas y los bloques de reglas desactualizados (`refresh_mcp_rules`).
