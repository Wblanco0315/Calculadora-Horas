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
- "¿Qué registré en el ticket 11111?" -> 'get_ticket_context(ticket: "11111", include_time_entries: true)'.

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
<!-- POCKETPROJECT MCP RULES END -->
```
