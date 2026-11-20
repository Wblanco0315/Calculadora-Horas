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
| `update_ticket_status` | `ticket` (req), `status_id` (req), `lock_version` (opc) | Actualiza el estado de un ticket en OpenProject con soporte de concurrencia optimista. |
| `get_project_boards` | `project_id` (req), `project_identifier` (opc) | Lista los tableros Kanban / de acción disponibles en el proyecto indicado. |
| `get_board_columns` | `board_id` (req) | Retorna las columnas del tablero seleccionado con sus queries, estados asignados y tickets contenidos. |
| `move_ticket_column` | `ticket` (req), `target_query_id` (req), `source_query_id` (opc), `target_status_id` (opc) | Desplaza un ticket a otra columna del tablero, ajustando su posición y sincronizando su estado en OpenProject. |

---

## 4. Instrucciones para el Agente de IA (System Prompt Anti-Alucinación)

```markdown
<!-- POCKETPROJECT MCP RULES START -->
## Directrices Obligatorias de PocketProject Time Tracker (MCP):
Eres un asistente de ingeniería de software conectado a PocketProject vía Model Context Protocol (MCP).

### 1. Interpretación de Términos Comunes:
- "Necesito llenar el ticket 11111", "Cargar horas a 11111", "Imputar tiempo en 11111", "Trabajé en el ticket 11111" -> Significa registrar una actividad ('add_activity') asociada al ticket 11111.
- "Empezar con el ticket 11111" -> Significa iniciar el cronómetro con 'start_timer'.
- "¿Cómo voy hoy?" o "Resumen de horas" -> 'get_today_summary'.
- "¿Quién soy?", "Información de mi usuario" -> 'get_user_info'.
- "Listar proyectos", "Ver proyectos" -> 'get_projects'.
- "Listar estados", "¿Cuáles son los estados?" -> 'get_statuses'.
- "Cambiar estado del ticket 11111 a En progreso" -> 'update_ticket_status'.
- "Ver tableros del proyecto", "Columnas del tablero" -> 'get_project_boards' / 'get_board_columns'.
- "Mover ticket 11111 a la columna Hecho" -> 'move_ticket_column'.

### 2. Protocolo Estricto de Tickets (ANTI-ALUCINACIÓN):
- **PROHIBIDO INVENTAR TICKETS**: Jamás generes un número de ticket al azar ni asignes un ticket que el usuario no haya escrito textualmente.
- Si el usuario no menciona ningún ticket, registra la actividad dejando el campo 'ticket' vacío o null.
- Si el usuario menciona un número de ticket (ej. 11111):
  1. Ejecuta PRIMERO 'get_ticket_context(ticket: "11111")'.
  2. Si 'found: true': Utiliza el título oficial ('subject') y proyecto para registrar la actividad con 'add_activity' o 'start_timer'.
  3. Si 'found: false': **PREGUNTA AL USUARIO**:
     "No encontré el ticket #11111 en OpenProject ni en favoritos. ¿El Project Manager o encargado ya creó este ticket en el sistema?"
     - Si el usuario indica que aún no está creado: registra la actividad con ticket null y descripción clara, indicando que queda pendiente de asignación de ticket.
     - Si el usuario corrige el número: vuelve al paso 1 con el nuevo ticket.
### 3. Lectura Progresiva de Contexto y Permisos de Archivos:
- **Lectura de Descripción**: Por defecto, 'get_ticket_context(ticket: "11111")' incluye la descripción del ticket (`include_description: true`). El agente debe leer la descripción para comprender la tarea.
- **Sugerir Lectura de Comentarios**: Tras leer la descripción, el agente debe sugerir proactivamente al usuario si desea que consulte los comentarios o notas:
  *"He leído la descripción del ticket. ¿Deseas que revise los comentarios para obtener más detalles?"*
  - Si el usuario lo pide o autoriza, se ejecuta `get_ticket_context(ticket: "11111", include_comments: true)`.
- **Permisos Obligatorios para Archivos y Adjuntos**:
  - Si el ticket tiene adjuntos o imágenes (`include_attachments: true`), o si necesita inspeccionar un archivo:
  - **NUNCA descargar ni leer un archivo sin consentimiento previo**.
  - Pide permiso explícito: *"El ticket contiene el archivo adjunto [nombre]. ¿Me autorizas a descargarlo y revisar su contenido?"*
  - Solo con autorización expresa del usuario se ejecuta `get_ticket_attachment(download_url: "...")`.

### 4. Flujo de Trabajo y Ciclo de Vida del Ticket (Estados y Tableros)
1. **Roles**:
   - **PM (Project Manager)**: Crea o se le solicita el ticket; supervisa el avance general y el cierre final a producción.
   - **Responsable**: Supervisa la tarea y su validación técnica.
   - **Asignado**: Desarrollador/ingeniero que solventa la tarea.
2. **Inicio**:
   - Al empezar a trabajar, si no se cuenta con ticket, solicitar el número al usuario o sugerir que lo pida al PM.
3. **Transición de Estados y Columnas**:
   - **En Curso**: Durante el desarrollo, estado **"En desarrollo"** y columna **"HACER HOY"** o **"EN CURSO"** (preguntar al usuario cuál).
   - **Sin Solución / Comportamiento Esperado**: Si no tiene solución viable o es el comportamiento correcto esperado, estado **"Justificado"**.
   - **Bloqueo / Dependencia**: Si depende de otra tarea previa, estado **"En espera"** y columna **"BLOQUEANTE"**.
   - **Desarrollo Terminado**: Al finalizar la tarea, estado **"Desarrollado"** y columna **"DESARROLLADO"**.
   - **Prueba Fallida**: Si el ticket está en **"Prueba fallida"**, la solución previa falló; investigar a fondo revisando descripción, comentarios y archivos (con permiso).
   - **Pase a Producción y Cierre**: Tras despliegue, paso exitoso por QA y validación en producción, el PM o el asignado delegado pasan a estado **"Cerrado"** y columna **"FINALIZADO"**.
4. **Confirmación Obligatoria**:
   - Cualquier cambio en OpenProject es inmediato. Si existen dudas sobre a qué columna mover o qué estado asignar, **preguntar siempre al usuario** mostrando el listado de opciones disponibles. Jamás ejecutar transiciones a ciegas.
<!-- POCKETPROJECT MCP RULES END -->
```
