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

PocketProject es el **único intermediario**: el MCP (2.x) no abre SQLite ni llama a OpenProject; todo pasa por la API local de la app (ver sección 6).

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `get_today_summary` | — | Today's logged minutes, target from the user's schedule, remaining time and activities. |
| `get_activities` | `date`, `limit` | Local activities of a date (local data is kept 3 months). |
| `search_activities` | `ticket`, `query`, `date_from`, `date_to`, `limit` | Searches local activities (last 3 months). |
| `add_activity` / `edit_activity` | `name`, `minutes`, `ticket`, `ticket_title`, `project_name`, `date` (+ `id` to edit) | Logs or edits a local activity; the ticket is resolved locally first, then in OpenProject. |
| `start_timer` / `stop_timer` | `ticket`, `name`… / `id` | Stopwatch (only one runs at a time). |
| `get_favorite_tickets` / `add_favorite_ticket` | — / `ticket`, `title`, `project_id`, `project_name` | Favorite tickets. |
| `search_tickets` | `query` | Local first (favorites, history); OpenProject only if nothing local matches. Returns `source`. |
| `get_ticket_context` | `ticket`, `include_description` (true), `include_comments`, `include_attachments`, `include_time_entries` | Local data + live OpenProject data, including `lockVersion`. |
| `get_ticket_form` | `ticket` | Editable fields and allowed values (statuses, priorities, assignees, responsibles, versions) + `lockVersion`. |
| `get_ticket_history` / `get_ticket_costs` | `ticket` | Comments and change history / cost totals. |
| `get_openproject_context` / `get_user_info` | — | PocketProject configuration and the connected OpenProject user. |
| `get_projects` / `get_statuses` / `get_project_versions` | `query`, `limit` / — / `project_id` | Reference data. |
| `sync_time_entries` | `ids` or `date` | Opens the app's send confirmation modal with those entries (one date); the user presses Send. The AI never sends time itself. |
| `get_my_tickets` | `statuses`, `project_id`, `role`, `include_closed` | Tickets assigned to the user (or where they are responsible) by status and project, grouped project by project with counts per status and each ticket's `lockVersion`. Without `statuses`: open tickets. |
| `get_project_boards` / `get_board_columns` | `project_id` / `board_id` | Boards and their real columns. |
| `get_time_cost_report` | ticket, project, user, activity, date range, `group_by` | OpenProject time entries (same query as the app's "Tiempo y costos" page); use it for dates older than 3 months. |
| `get_time_statistics` | `from`, `to`, `refresh` | Hours logged in OpenProject per day and project (app cache). |
| `update_ticket_status` | `ticket`, `status_id`, `lock_version` | **After explicit authorization.** |
| `update_ticket_version` | `ticket`, `version_id` (or null), `lock_version` | **After explicit authorization.** |
| `update_ticket_fields` | `ticket`, `lock_version`, subject, dates, estimate, status, priority, assignee, responsible, version | **After explicit authorization.** Values from `get_ticket_form`; null clears. |
| `move_ticket_column` | `ticket`, `target_query_id`, `lock_version`, `source_query_id`, `target_status_id` | **After explicit authorization.** |
| `get_ticket_attachment` | `download_url`, `user_authorized: true` | Reads an attachment (only from the configured OpenProject). **After explicit authorization.** |
| `download_ticket_attachment` | `download_url`, `file_name`, `user_authorized: true` | Saves an attachment in Downloads. **After explicit authorization.** |
| `draft_ticket_comment` | `ticket`, `text` | Opens the ticket in PocketProject with the comment preloaded; **the user** reviews and sends it. The AI never posts comments. |
| `request_attachment_upload` | `ticket` | Opens the ticket's Attachments tab; **the user** uploads the file. |
| `open_app` / `set_app_mode` / `open_app_view` / `open_ticket_in_app` | — / `mode` / `view` + params / `ticket` | Opens PocketProject, switches compact/full mode, opens a view or a ticket. |
| `get_compatibility` | — | Protocol/version compatibility with the installed app and whether it is running. |

--- | :--- | :--- |
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
| `sync_time_entries` | `ids` o `date` | Acción de interfaz `sync_time_entries`: Rust valida las entradas (una sola fecha; omite las sin ticket, ya enviadas o con cronómetro corriendo) y `McpActionService` abre el modal de confirmación de envío (`sync-confirm-modal`) con ellas seleccionadas. Solo el botón Enviar del usuario las sube, con el tipo de actividad de cada entrada (regla 11). |
| `get_my_tickets` | `statuses`, `project_id`, `role` (`assignee`/`responsible`/`any`), `include_closed` | Tickets del usuario por estado y proyecto (operación `my_tickets`), agrupados proyecto por proyecto con conteo por estado y el `lockVersion` de cada ticket. Los estados se aceptan por nombre (sin distinguir mayúsculas ni tildes) o ID; sin `statuses` devuelve los abiertos. Máximo 500 tickets (`truncated`). La IA pregunta primero si es un proyecto o todos (regla 9). |
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
GET /ping devuelve version, protocolVersion, minMcpVersion, rulesVersion, capabilities
```

Ambos archivos viven en el directorio de datos de la app, junto a `ipc.json` (`%APPDATA%\com.dev.wilsonblanco` en Windows).

| Constante | Dónde | Cuándo cambiarla |
|---|---|---|
| `MCP_PROTOCOL_VERSION` | `src-tauri/src/service/mcp_contract.rs` y `pocketproject-mcp/src/config/app-contract.ts` | Cambio incompatible del esquema SQLite, de los endpoints IPC o de la semántica de las herramientas. Se sube en los dos proyectos a la vez. |
| `MIN_MCP_VERSION` | `mcp_contract.rs` | Primera versión publicada del MCP que implementa el protocolo actual. |
| `MCP_PACKAGE_SPEC` | `mcp_contract.rs` | Rango npm escrito en la configuración de los clientes (`pocketproject-mcp@2`). Con un rango de versión mayor, `npx` descarga la versión compatible más nueva en cada arranque del cliente. Se cambia al publicar una versión mayor nueva. |
| `rulesVersion` | calculado (hash del prompt) | Nunca a mano. |

Resultado de la comprobación (`compatible` / `reason`):
- `protocol_mismatch`: la app y el MCP implementan protocolos distintos.
- `mcp_outdated`: el MCP es anterior a `minMcpVersion`.
- `app_not_found` (solo en el MCP): la app no ha publicado el contrato (no está instalada o es una versión anterior).

El panel **Compatibilidad MCP** (setup → MCP y Configuración → Sistema) muestra la versión de la app y del protocolo, el último MCP que arrancó, cada cliente configurado (actualizado si usa el `packageSpec` vigente) y cada archivo de reglas registrado. **Actualizar todo** reescribe las configuraciones de cliente desactualizadas y los bloques de reglas desactualizados (`refresh_mcp_rules`).

### Aviso de actualización obligatoria

`core/services/mcp-compatibility.service.ts` guarda el estado (`get_mcp_status`) que comparten el panel y el diálogo global `shared/components/mcp-update-dialog` (montado en `AppComponent`). Se consulta al arrancar la app y cada vez que un MCP envía `mcp_hello`. El diálogo aparece, una vez terminado el onboarding, cuando:
- el último MCP que arrancó es incompatible (`protocol_mismatch` o `mcp_outdated`, p. ej. tras una actualización de la app que subió `MIN_MCP_VERSION`), o
- algún cliente de IA configurado usa un `packageSpec` distinto del vigente.

Muestra la versión instalada frente a la requerida, permite reescribir la configuración de los clientes y copiar `npx -y <packageSpec> setup`, y pide reiniciar el cliente de IA. **Más tarde** lo oculta hasta que cambie la situación o se reinicie la app; se cierra solo cuando se conecta un MCP compatible.

---

## 6. API local de la app para el MCP (protocolo 2)

`src-tauri/src/ipc.rs` sirve en `127.0.0.1:<puerto aleatorio>` (puerto y token por ejecución en `ipc.json`). Todas las rutas salvo `/ping` exigen el token (`X-PocketProject-Token` o `Authorization: Bearer`). Cada conexión se atiende en su propio hilo; el cuerpo se lee completo según `Content-Length` (máx. 1 MB).

| Ruta | Uso |
|---|---|
| `GET /ping` | Versión, protocolo, `rulesVersion` y `capabilities` (`operations`, `actions`). Sin token. |
| `POST /api/<operación>` | Datos locales y OpenProject (`service/mcp_api.rs`). Respuesta `{ ok, data }` o `{ ok: false, error }`. La URL y el token de OpenProject nunca salen de la app. |
| `POST /action` | Acciones de interfaz: la app se muestra y emite `mcp-action`, que ejecuta `McpActionService` (frontend). |
| `POST /notify`, `POST /show` | Compatibilidad: avisos (`mcp_hello`) y mostrar la ventana. |

**Operaciones** (`mcp_api::OPERATIONS`):
- Locales: `app_context` (configuración sin token), `activities`, `activity_save`, `activity_delete`, `favorites`, `favorite_save` (emiten `db-changed`).
- Primero local, luego OpenProject: `search_tickets` (favoritos → historial → búsqueda en OpenProject), `ticket_info`, `ticket_context` (resumen local + datos en vivo), `time_statistics` (caché o `refresh`).
- Lectura en OpenProject: `current_user`, `projects`, `statuses`, `project_versions`, `boards`, `board_columns`, `ticket_form`, `ticket_costs`, `time_cost_report`, `my_tickets` (tickets del usuario por estado y proyecto, `service/my_ticket.rs`).
- Escritura (exigen `lock_version`; la IA pide autorización antes): `update_status`, `update_version`, `update_fields`, `move_column`. Emiten `mcp-event` `ticket_updated` y el detalle abierto se recarga.
- Adjuntos (exigen `user_authorized: true` y mismo origen que el OpenProject configurado; `request_attachment` lo vuelve a comprobar): `attachment_content`, `attachment_download` (carpeta Descargas).

**Acciones** (`mcp_api::ACTIONS`, ejecutadas por `core/services/mcp-action.service.ts`):
- `open_app`, `set_mode` (`compact` / `full`), `navigate` (`compact`, `overview`, `time-entries`, `projects`, `boards`, `board`, `ticket`, `reports`, `settings` con sus parámetros), `open_ticket`.
- `draft_comment {ticket, text}`: abre `/dashboard/tickets/:id` con el comentario precargado en el editor y el aviso "Comentario propuesto por la IA"; **solo el usuario lo envía** (`TicketIntentService`, sin pasar el texto por la URL).
- `upload_attachment {ticket}`: abre la pestaña Archivos con el botón **Adjuntar archivo** resaltado; el usuario elige y sube el archivo.
- `sync_time_entries {ids | date}`: abre el modal de confirmación de envío de tiempos (ventana compacta o vista Registro de tiempo) con esas entradas seleccionadas (`ActivityService.openSyncConfirmation`); **solo el usuario las envía** pulsando Enviar.
