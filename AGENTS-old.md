# AGENTS.md - Guía y Convenciones para Agentes de IA

Este documento define las directrices, la arquitectura y las buenas prácticas para cualquier agente de inteligencia artificial (Antigravity, Claude Code, Cursor, Copilot, etc.) que opere en este repositorio.

---

## 1. Descripción del Proyecto

**PocketProject (Calculadora de Horas)** es una aplicación de escritorio ligera y moderna desarrollada con **Tauri v2** y **Vue 3**. Permite a los usuarios registrar, calcular y gestionar el tiempo dedicado a sus tareas diarias, así como sincronizar entradas de tiempo y estados con **OpenProject**. Además, cuenta con integración con servidores MCP (Model Context Protocol) para permitir que asistentes de IA interactúen con la base de datos local de actividades.

---

## 2. Pila Tecnológica (Tech Stack)

- **Frontend:**
  - **Framework:** Vue 3 (Composition API con `<script setup lang="ts">`)
  - **Estilos:** Tailwind CSS v4
  - **Build Tool:** Vite 6
  - **Lenguaje:** TypeScript 5.6
- **Capa Desktop & Sistema:**
  - **Runtime:** Tauri v2 (Rust)
  - **Base de Datos Local:** SQLite (`@tauri-apps/plugin-sql` en frontend, `better-sqlite3` en MCP)
  - **Plugins de Tauri:**
    - `@tauri-apps/plugin-sql` (persistencia local)
    - `@tauri-apps/plugin-updater` (actualizaciones automáticas)
    - `@tauri-apps/plugin-notification` (notificaciones del sistema)
    - `@tauri-apps/plugin-autostart` (inicio con el SO)
    - `@tauri-apps/plugin-http`, `@tauri-apps/plugin-log`, `@tauri-apps/plugin-process`, `@tauri-apps/plugin-opener`
- **MCP Server (`mcp-server/`):**
  - Node.js (ES Modules)
  - `@modelcontextprotocol/sdk`
  - `better-sqlite3`
- **Gestores de Paquetes:** Bun / npm

---

## 3. Estructura del Proyecto

```text
Calculadora-Horas/
├── .agents/                # Habilidades (skills), plugins y configs para agentes de IA
│   └── skills/calculadora-horas/  # Skill principal para interacción del asistente
├── mcp-server/             # Servidor MCP local para exponer SQLite a agentes de IA
│   ├── index.js            # Implementación del servidor MCP (get_activities, add_local_activity)
│   └── package.json
├── src/                    # Código fuente del frontend (Vue 3 + TS)
│   ├── assets/             # Recursos estáticos, CSS
│   ├── components/         # Componentes Vue (calculator, row, hoursForm, etc.)
│   ├── composables/        # Lógica reactiva reutilizable (useActivities, useUpdater, etc.)
│   ├── utils/              # Utilidades de DB (db.ts) y tiempo (timeUtils.ts)
│   ├── App.vue             # Componente raíz
│   └── main.ts             # Punto de entrada Vite/Vue
├── src-tauri/              # Backend nativo en Rust y configuración de Tauri
│   ├── src/                # Código Rust de Tauri
│   ├── capabilities/       # Permisos de plugins y seguridad Tauri v2
│   ├── tauri.conf.json     # Configuración de ventana, plugins y bundle
│   └── Cargo.toml          # Dependencias de Rust
├── package.json            # Scripts y dependencias del frontend
└── vite.config.ts          # Configuración del bundler Vite
```

---

## 4. Comandos de Desarrollo y Construcción

> Se recomienda usar `bun`, aunque `npm` es totalmente compatible.

- **Instalación de dependencias:**
  ```bash
  bun install   # o: npm install
  ```
- **Iniciar servidor de desarrollo Frontend (Vite):**
  ```bash
  bun run dev   # o: npm run dev
  ```
- **Ejecutar la aplicación de escritorio completa (Tauri + Vite en modo dev):**
  ```bash
  bun run tauri dev   # o: npm run tauri dev
  ```
- **Verificación de tipos TypeScript y build frontend:**
  ```bash
  bun run build   # Ejecuta: vue-tsc --noEmit && vite build
  ```
- **Compilar ejecutable de producción (instalador de escritorio):**
  ```bash
  bun run tauri build   # o: npm run tauri build
  ```

---

## 5. Esquema de Base de Datos Local (`activities`)

La tabla SQLite `activities` almacena los registros de tiempo locales:

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `id` | TEXT PK | UUID único de la actividad |
| `name` | TEXT | Descripción de la actividad realizada |
| `minutes` | INTEGER | Tiempo en minutos |
| `seconds` | INTEGER | Tiempo en segundos |
| `date` | TEXT | Fecha en formato `YYYY-MM-DD` |
| `ticket` | TEXT | Identificador o número del ticket en OpenProject |
| `ticketTitle` | TEXT | Título del ticket de OpenProject |
| `projectId` | TEXT | ID del proyecto |
| `statusId` / `statusName` | TEXT | Estado en OpenProject |
| `synced` | INTEGER (0/1) | Si ya fue sincronizada a OpenProject |
| `created_by_ai` | INTEGER (0/1) | Marcado en 1 si fue añadida mediante agente / MCP |
| `timerSeconds`, etc. | - | Estado del cronómetro local |

---

## 6. Servidor MCP (`mcp-server`) y Asistente de IA

El servidor MCP permite que herramientas de IA interactúen de forma segura con la base de datos local sin interferir con la UI ni enviar peticiones sin autorización a APIs externas.

### Herramientas MCP disponibles:
1. `get_activities`:
   - Parámetros: `date` (opcional, formato `YYYY-MM-DD`).
   - Retorna las actividades registradas (las últimas 50 si no se indica fecha).
2. `add_local_activity`:
   - Parámetros obligatorios: `name`, `minutes`, `date` (`YYYY-MM-DD`), `ticket`.
   - Inserta la actividad con `created_by_ai = 1` y `synced = 0`.
   - **Importante:** La actividad queda guardada localmente en estado pendiente; el usuario debe presionar "Enviar" en la UI para sincronizar a OpenProject.

---

## 7. Reglas y Directrices para Agentes

1. **Uso de Vue 3:**
   - Emplea siempre `<script setup lang="ts">` y la Composition API.
   - Mantén componentes desacoplados usando composables (`useActivities.ts`, `useUserConfig.ts`, etc.).
2. **Ventana Frameless & UI:**
   - La ventana de Tauri es transparente y sin bordes del sistema (`decorations: false`, `transparent: true`).
   - Conserva la barra de título personalizada (`Titlebar.vue`) y las áreas con atributo `data-tauri-drag-region`.
3. **Manejo de Base de Datos y Persistencia:**
   - En el frontend, utiliza `src/utils/db.ts` (`@tauri-apps/plugin-sql`).
   - En scripts independientes o MCP, utiliza `mcp-server/index.js` (`better-sqlite3`).
4. **Seguridad y Red:**
   - **No** realices peticiones HTTP directas ni almacenes credenciales en el código para `openproject.wposs.com`.
   - Toda interacción de agentes para añadir o consultar tiempo debe pasar por el servidor MCP local o los composables definidos.
5. **Calidad de Código y Tipos:**
   - Evita el uso indiscriminado de `any`. Extiende las interfaces en `src/composables/useActivities.ts` si se requieren nuevas propiedades.
   - Ejecuta `bun run build` o `vue-tsc --noEmit` antes de dar por terminada una tarea que altere código TypeScript o Vue.
