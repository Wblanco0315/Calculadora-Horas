# Módulo: Overview (Vista de Resumen General)

El módulo `overview` representa la vista de contenido principal de **PocketProject** cargada dentro del contenedor del dashboard. Proporciona un resumen visual y reactivo de la jornada laboral diaria y semanal, así como el estado de configuración de la cuenta y conectividad con OpenProject.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/overview/`
- **Ruta de Navegación**: `/dashboard/overview` (cargada como ruta hija en `dashboard.router.ts`)

```
src/app/modules/overview/
├── components/
│   ├── overview-banner/
│   │   └── overview-banner.component.ts      # Banner de bienvenida y estado de configuración
│   ├── overview-summary/
│   │   └── overview-summary.component.ts     # 3 tarjetas: Horario de hoy, Apariencia, API OpenProject
│   └── overview-schedule/
│       └── overview-schedule.component.ts    # Cuadrícula semanal detallada de 7 días y disparador de la modal
├── modals/
│   └── schedule-modal/
│       └── schedule-modal.component.ts       # Modal Dialog (<p-dialog>) para editar horarios y descanso
├── pages/
│   ├── overview.page.html                    # Esqueletos de carga (<p-skeleton>) y orquestación de subcomponentes
│   ├── overview.page.ts                      # Smart component de página vinculado a StorageService.isLoading
│   └── overview.page.css                     # Estilos de la página
└── overview.router.ts                        # Enrutador del módulo con carga diferida
```

---

## 2. Componentes y Funcionalidades

### 2.1. Banner de Estado (`app-overview-banner`)
- **Estructura en dos columnas**:
  - **Columna Izquierda (Saludo y Usuario)**: Al estar correctamente logueado con OpenProject (`isLoggedIn()`), muestra un saludo personalizado con el nombre del usuario (`"Bienvenido {User}"`), acompañado del subtítulo de estado. Si aún no está conectado, presenta el mensaje de bienvenida por defecto con el recordatorio para configurar su token.
  - **Columna Derecha (Día de la semana y Estado de Conexión)**:
    - Widget estilizado con el día de la semana en formato `"THU / [Día de la semana]"` (e.g., `THU / Jueves` en español o `THU / Thursday` en inglés), calculado reactivamente con base en la fecha actual y traducido mediante `ScheduleService`.
    - Componente `<p-tag>` de PrimeNG que indica visualmente si OpenProject se encuentra vinculado (`success`) o pendiente de token (`warn`).
- **Sincronización Reactiva del Perfil**: Obtiene y persiste de manera automática el nombre de usuario autenticado (`user_name`) desde la API de OpenProject en SQLite y `localStorage`.

### 2.2. Tarjetas de Resumen y Métricas (`app-overview-summary`)
- **Horario de hoy**: Identifica automáticamente el día en curso (`todaySchedule`), informando si es día laborable o de descanso, horas esperadas calculadas descontando el almuerzo, progreso (`<p-progressbar>`) y total acumulado semanal.
- **Apariencia**: Resumen del modo de tema activo (oscuro/claro) y color primario seleccionado con indicador visual.
- **OpenProject API**: Detalle de la URL del servidor y estado del token.

### 2.3. Desglose Semanal Detallado (`app-overview-schedule`)
- Muestra el desglose de los 7 días de la semana con badges que destacan el día actual (`ring-primary-500`, `bg-primary-50/50`).
- Los nombres de los días se traducen dinámicamente mediante `TranslatePipe` y la clave obtenida de `ScheduleService.getDayKey()`, garantizando la reactividad inmediata al cambiar de idioma.
- Muestra las horas calculadas por jornada, intervalos de entrada/salida y minutos de descanso/almuerzo.
- Botón de acción **"Editar horario"** (`dashboard.editScheduleBtn`) que abre de forma inmediata y contextual la ventana modal de edición (`app-schedule-modal`) sin salir de la vista de Overview ni redirigir al asistente de bienvenida.

### 2.4. Modal de Edición de Horarios (`app-schedule-modal`)
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

### 2.5. Esqueletos de Carga y Carga Progresiva con `@defer` (`OverviewPage`)
- La página implementa un bloque nativo `@defer (when isLoaded(); prefetch on idle)`.
- El bloque `@placeholder (minimum 350ms)` contiene la plantilla de esqueletos `<p-skeleton>` (banner, tarjetas de métricas y cuadrícula semanal), mostrándose de inmediato y evitando cualquier parpadeo de interfaz (layout shift).
- Permite que Angular CLI divida automáticamente `app-overview-banner`, `app-overview-summary`, `app-overview-schedule` y `app-schedule-modal` en fragmentos JavaScript independientes (`chunk-...js`) que se descargan e hidratan de manera progresiva.
