# Módulo: Overview (Vista de Resumen General)

El módulo `overview` representa la vista de contenido principal de **PocketProject** cargada dentro del contenedor del dashboard. Muestra las estadísticas del tiempo registrado en OpenProject (resumen del día, semana y mes, gráfica diaria, ranking de proyectos) y el horario semanal con el avance de cada día.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/overview/`
- **Ruta de Navegación**: `/dashboard/overview` (cargada como ruta hija en `dashboard.routes.ts`)

```
src/app/modules/overview/
├── components/
│   ├── overview-banner/                 # Saludo y día de la semana
│   ├── overview-summary/                # 4 tarjetas: Hoy, Esta semana, Este mes, Por sincronizar
│   ├── overview-time-chart/             # Gráfica de horas registradas por día (7 / 30 días) vs. meta
│   ├── overview-project-ranking/        # Ranking de proyectos con más tiempo (top 5: semana / mes / 3 meses)
│   └── overview-schedule/               # Semana actual: registrado / meta por día (2.º elemento)
├── interfaces/
│   └── statistic.interface.ts           # Espejo de model::statistic + tipos derivados
├── modals/
│   └── schedule-modal/                  # <p-dialog> para editar horarios y descanso
├── pages/
│   └── overview/overview.page.{ts,html,css}
├── services/
│   └── statistic.service.ts             # Estadísticas precalculadas y derivadas (signals)
└── overview.routes.ts
```

---

## 2. Componentes y Funcionalidades

### 2.1. Banner (`app-overview-banner`)
- Botón de solo icono (`tablerRefresh`) para volver a leer las entradas de OpenProject; su `title` indica la hora de la última actualización y muestra el spinner mientras carga.
- Saludo con el nombre del usuario de OpenProject (o el aviso para conectar el token si no hay sesión) y el día de la semana (`THU / Jueves`).
- Sincroniza el nombre del usuario autenticado (`user_name`) en SQLite y `localStorage`.

### 2.2. Resumen del día, semana y mes (`app-overview-summary`)
- **Hoy / Esta semana / Este mes**: tiempo registrado, meta del periodo según el horario (`StorageService.targetMinutesFor`: semana completa de lunes a domingo, mes completo), `<p-progressbar>` de avance y variación porcentual frente al mismo tramo del periodo anterior (ayer, semana pasada hasta el mismo día, mes pasado hasta el mismo día). Datos secundarios: registros de hoy, días activos de la semana y promedio por día activo del mes.
- **Por sincronizar**: único dato local. Minutos y registros de actividades del equipo aún no subidas a OpenProject (`synced = 0`, cualquier fecha) y **racha** de días laborables consecutivos cumpliendo la meta (hoy cuenta solo cuando ya se alcanzó).
- Iconos directos junto al título, sin contenedores de fondo; la variación usa color + flecha + texto.

### 2.3. Gráfica de horas registradas (`app-overview-time-chart`)
- `<p-chart type="bar">` de PrimeNG (chart.js) con dos series en el mismo eje: barras con el tiempo registrado por día (color primario del tema) y línea discontinua escalonada con la meta del horario.
- `<p-selectbutton>` para 7 o 30 días; tooltip por día con ambas series en formato `Xh MMm`, leyenda inferior y eje Y en horas.
- Colores reactivos al tema (`ThemeService.currentHex`, `isDark`) e idioma (`LanguageService.currentLang` para las fechas).
- chart.js solo se descarga con este componente (bloque `@defer` de la página).

### 2.4. Ranking de proyectos (`app-overview-project-ranking`)
- Top 5 (`RANKING_LIMIT`) de proyectos por tiempo registrado en OpenProject con `<p-selectbutton>` Semana / Mes / 3 meses: posición, nombre (o "Sin proyecto"), tiempo, porcentaje sobre el total del periodo (todos los proyectos) y barra proporcional al primero.

### 2.5. Horario de la semana (`app-overview-schedule`)
- Segundo elemento de la página, justo después del banner.
- Fila compacta de 7 días (4 columnas en móvil, 7 desde `sm`): día abreviado (`days.mon`…), tiempo registrado / meta del día y una barra de avance (`StatisticService.currentWeekMinutes`). El día actual se resalta con el borde primario; los días no laborables aparecen atenuados con "Descanso". El horario de entrada y salida queda en el `title` de cada día.
- Encabezado con la meta semanal y el botón **Editar horario** (`dashboard.editScheduleBtn`), que abre `app-schedule-modal` sin salir del overview.

### 2.6. Modal de Edición de Horarios (`app-schedule-modal`)
- Componente modal basado en `<p-dialog>` de PrimeNG (`Dialog`).
- **Encabezado**: Icono de calendario estilizado, título internacionalizado y descripción.
- **Cuerpo Reutilizable**: Aloja el componente transversal `<app-schedule-editor>` (`src/app/shared/components/schedule-editor/`), extrayendo y centralizando la lógica que antes pertenecía exclusivamente al asistente de setup.
  - Selector interactivo de días (L, M, M, J, V, S, D).
  - Selector de minutos de almuerzo/descanso con presets rápidos (0m, 30m, 45m, 60m).
  - Selectores de hora de entrada y salida con `<p-datepicker [timeOnly]="true">`.
  - Botón de guardado y creación de reglas de horario.
  - Lista de horarios agrupados con botones de edición y eliminación.
- **Pie de Modal**:
  - Resumen en tiempo real del total de horas calculadas por semana (`formattedWeeklyHours`).
  - Botón "Cancelar" que restaura el estado a la última configuración guardada (`resetFromCurrentConfig()`).
  - Botón "Guardar" que persiste la nueva configuración en SQLite y localStorage (`saveSchedule()`) actualizando en tiempo real todos los componentes del Dashboard.

### 2.7. Esqueletos de Carga y Carga Progresiva con `@defer` (`OverviewPage`)
- La página implementa un bloque nativo `@defer (when isLoaded(); prefetch on idle)`.
- El bloque `@placeholder (minimum 350ms)` contiene la plantilla de esqueletos `<p-skeleton>` (banner, 4 tarjetas, gráfica, ranking y cuadrícula semanal), mostrándose de inmediato y evitando cualquier parpadeo de interfaz (layout shift).
- Permite que Angular CLI divida automáticamente los componentes del overview (incluida la gráfica con chart.js) y `app-schedule-modal` en fragmentos JavaScript independientes (`chunk-...js`) que se descargan e hidratan de manera progresiva.


---

## 3. Estadísticas (`StatisticService`)

- **Fuente**: las entradas de tiempo del usuario en OpenProject, leídas con la misma consulta del reporte "Tiempo y costos" (`service::report::fetch_time_cost_report_entries`, filtros `user_id = me` y rango `spent_on`). Lo que aún no se ha subido no cuenta en Hoy/Semana/Mes, la gráfica ni el ranking; aparece en la tarjeta **Por sincronizar**.
- **Ventana**: los últimos 3 meses (`LOCAL_RETENTION_MONTHS` en `core/utils/retention.util.ts`), suficiente para la comparación con el mes anterior, la gráfica de 30 días y el ranking de 3 meses.
- **Precálculo y caché**: Rust resume las entradas por (día, proyecto) (`service::statistic::summarize`) y guarda solo ese resumen en SQLite (`time_entry_daily_statistic`, más `statistic_meta.time_entry_refreshed_at`). Cada actualización reemplaza el rango consultado y elimina las filas anteriores a la ventana.
- **Comandos**: `get_time_statistics(from)` lee la caché y el total local por sincronizar (sin red); `refresh_time_statistics(url, token, from, to)` consulta OpenProject, reemplaza la caché y devuelve el resultado. Si OpenProject falla, la caché no se toca.
- **Cuándo se actualiza**: al abrir el overview se muestra la caché al instante y se consulta OpenProject si tiene más de 5 minutos; también 2 s después de sincronizar actividades (cambio en las actividades sincronizadas del día cargado) y con el botón del banner. Cualquier cambio local recarga la caché y el total por sincronizar (debounce de 300 ms).
- **Derivados memoizados**: totales por día, resúmenes, serie de 30 días, racha y rankings son `computed` sobre el resumen; cambiar de rango o pestaña no vuelve a consultar.
- **Modo navegador** (sin Tauri): misma consulta vía `TimeEntryApiService.getTimeCostReportEntries` y resumen en TypeScript, sin caché persistente.
