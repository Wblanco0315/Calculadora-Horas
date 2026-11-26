# Módulo: Compact (Modo Compacto / Calculadora de Horas)

El módulo `compact` replica fielmente la vista original de la **Calculadora de Horas** de PocketProject adaptada a la arquitectura de Angular 22+, PrimeNG y Tailwind CSS v4. Funciona como la interfaz de escritorio compacta (tamaño original de 525x800 px) para registrar, gestionar y sincronizar actividades diarias de tiempo con OpenProject.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/compact/`
- **Ruta de Navegación**: `/compact`

```
src/app/modules/compact/
├── components/
│   └── stats-hero/
│       └── stats-hero.component.{ts,html}    # Panel de estadísticas con SelectButton y degradado dinámico de tema
├── modals/
│   └── ticket-context-modal/
│       └── ticket-context-modal.component.{ts,html}  # Modal de contexto extendido del ticket (solo modo compacto)
├── pages/
│   └── compact/compact.page.{ts,html,css}  # Smart component con filtrado reactivo y gestión de estado
└── compact.routes.ts                         # Enrutador del módulo con carga diferida
```

La fila de actividad y los modales de actividad (`app-activity-row`, `app-activity-form-modal`, `app-favorites-modal`, `app-reset-confirm-modal`, `app-sync-confirm-modal`) pertenecen al dominio de registro de tiempo y viven en el módulo `time-entry` (`modules/time-entry/components` y `modules/time-entry/modals`); el modo compacto los importa desde allí. `app-close-confirm-modal` está en `shared/components/close-confirm-modal` porque lo usan compacto, dashboard y setup.


---

## 2. Componentes Clave y Réplica Fiel

### 2.1. Barra de Título Reutilizable (`app-header`)
- **Ubicación**: `shared/components/app-header/app-header.component.ts`
- **Responsabilidad y Diseño**:
  - Altura nativa de 32px (`h-8`), coincidiendo con la barra de título original de Windows.
  - Barra de título unificada y reutilizable con arrastre programático fluido (`WindowService.startDragging`) en todo el encabezado con exclusión automática de controles interactivos, isologo oficial (`app-logo`), título de la aplicación y versión actual (`v{{ version }}`).
  - Botón de alternancia de tema claro/oscuro (`tablerSun` / `tablerMoon`), botón de minimizar (oculta a la bandeja del sistema / iconos ocultos), botón de maximizar / restaurar y botón de cerrar que invoca el modal de confirmación `app-close-confirm-modal`.

### 2.2. Panel de Estadísticas Hero (`app-stats-hero`)
- **Ubicación**: `components/stats-hero/stats-hero.component.ts`
- **Integración PrimeNG y Diseño**:
  - Degradado que utiliza **exclusivamente tokens primarios dinámicos del tema seleccionado**: `bg-linear-to-b from-primary-500 to-primary-600 dark:from-primary-950 dark:to-zinc-900 text-white`.
  - Encabezado con etiqueta "TOTAL REGISTRADO" y "Mínimo del día: HH:MM / decimal".
  - Contador numérico prominente en fuente monoespaciada (`JetBrains Mono`) con botón "Reiniciar" (`<button pButton>` con `ButtonDirective`) que dispara el modal dedicado `app-reset-confirm-modal`.
  - **Uso Oficial de `SelectButton` de PrimeNG (`<p-selectbutton>`)** para el conmutador de formato `[ HH:MM | DECIMAL ]`, permitiendo alternar reactivamente el formato de horas en toda la aplicación.
  - **Transiciones Fluidas y Estabilidad de Layout (`animate-timeSwap`)**: Transición suave mediante micro-animación sin saltos bruscos (`animate-timeSwap`) en el total, meta y horas restantes al cambiar de formato, manteniendo bloqueada la altura y evitando cualquier estiramiento o desplazamiento visual de la interfaz.
  - Indicador de estado reactivo hacia el mínimo exigido: "¡Mínimo cumplido! X extras", "¡Mínimo diario cumplido!" o "X restantes para el mínimo".
  - Barra de progreso delgada (`h-1.5`) de alto contraste con fondo semitransparente y relleno blanco que refleja el avance frente a las horas mínimas requeridas.

### 2.3. Barra de Saludo y Acciones Rápidas
- **Ubicación**: En `compact.page.html` (bajo el hero).
- **Diseño**:
  - Subtítulo dinámico (`REGISTRO DEL DÍA` si es hoy o `REGISTRO HISTÓRICO` al explorar fechas pasadas o futuras) y saludo `Hola, {{ currentUserName() }} 👋`.
  - Botón **"Favoritos"**: Abre directamente el modal independiente de favoritos (`app-favorites-modal`) mediante `<button pButton>` con icono de estrella dorada.
  - Botón **"Añadir"**: Botón primario (`<button pButton>`) con icono de suma que abre el modal independiente de actividad (`app-activity-form-modal`).

### 2.4. Barra de Navegación de Fecha (Exploración Histórica)
- **Ubicación**: En `compact.page.html` (entre la barra de saludo y la barra de filtros).
- **Integración PrimeNG y Funcionalidad**:
  - **Selector Dinámico con Indicador "Hoy"**: Cuando la jornada activa es la actual, el selector de fecha muestra de forma prominente la etiqueta **"Hoy"** junto al icono de calendario. Al hacer clic, abre el desplegable del calendario para saltar a cualquier otra fecha.
  - **Botón Día Anterior**: Botón con directiva `pButton` e icono `tablerChevronLeft` (`setPreviousDay()`) siempre disponible para retroceder y revisar jornadas pasadas.
  - **Controles de Avance e Historial**: Al encontrarse en un día pasado, el selector muestra la fecha seleccionada (`YYYY-MM-DD`), habilitando el botón de día siguiente (`tablerChevronRight`) y el botón directo para retornar a **"Hoy"** (`setToday()`).
  - **Etiqueta Contextual Formateada**: Muestra a la derecha el nombre del día y la fecha localizada (e.g. `Mié, 18 de nov.` o `Vie, 6 de nov.`).

### 2.5. Barra de Búsqueda, Filtros con Popover y Sincronización
- **Ubicación**: En `compact.page.html`.
- **Integración PrimeNG**:
  - Input de búsqueda en tiempo real: `Filtrar por ticket o descripción...` con icono de lupa.
  - **Filtros Avanzados mediante Popout de PrimeNG (`<p-popover #filterPopover>`)**:
    - Al hacer clic en el botón de filtro (`tablerFilter`), se despliega un popout flotante elegante de PrimeNG.
    - Contiene controles de selección basados en PrimeNG (`<p-select>`):
      1. Selector de proyectos (`p-select` con opción "Proyectos (Todos)").
      2. Selector de ordenación (`p-select` con opción por defecto, mayor y menor).
      3. Selector de estado (`p-select` con opción todos, sincronizados y pendientes).
      4. Botón de limpieza rápida de filtros (`<button pButton variant="text" severity="danger">`).
  - Controles de sincronización con OpenProject (cuando existen actividades pendientes y token configurado):
    - Modo normal: Botón "Todos" (sincroniza pendientes) y botón "Seleccionar" (habilita selección múltiple).
    - Modo selección activo: Botón "Cancelar" y botón "Enviar (X)".

### 2.6. Lista y Fila de Actividad (`app-activity-row`)
- **Ubicación**: `modules/time-entry/components/activity-row/activity-row.component.ts` (+ `.html`)
- **Responsabilidad y Comportamiento**:
  - Checkbox para selección rápida cuando el modo de selección está habilitado.
  - Barra de acento lateral reactiva: verde esmeralda (`bg-emerald-500`) para tareas sincronizadas, color primario (`bg-primary-500`) para pendientes y rojo rosa (`bg-rose-500`) al confirmar eliminación.
  - **Jerarquía Visual Optimizada**:
    - **Nombre del proyecto encima del título del ticket**: Se muestra el icono de carpeta y el nombre del proyecto en la parte superior.
    - **Línea de Ticket y Título**: Badge de ticket `#12345` con su título en mayúsculas y acento temático.
    - **Row inicial limpio y despejado**: Contador de duración (`HH:MM` o decimal) con ancho estable (`min-w-[4.75rem]`) y animación fluida (`animate-timeSwap`) para evitar que el título de la tarea se estire al alternar a formato decimal, pill activo de cronómetro (si está en marcha o pausado), badge de sincronización y **un único botón de acciones** (`tablerDotsVertical`).
  - **Menú de Acciones Centralizado en Popover (`<p-popover #actionPopover>`)**:
    - Reemplaza la acumulación de múltiples botones por un único disparador contextual limpio que abre un Popover de PrimeNG.
    - Opciones integradas:
      1. **Cronómetro**: Iniciar / Pausar cronómetro con apertura directa de controles extendidos.
      2. **Sincronizar a OpenProject**: Envío directo o reenvío en caso de tareas ya sincronizadas.
      3. **Copiar descripción**: Copia al portapapeles la descripción (o título si la descripción está vacía).
      4. **Ver / Ocultar detalles**: Alterna el panel expandible inferior.
      5. **Editar actividad**: Abre el modal de edición `app-activity-form-modal`.
      6. **Eliminar actividad**: Con confirmación inline dentro de la propia fila (`¿Eliminar actividad? [Aceptar] [Cancelar]`).
  - **Detalle Expandible por Toggle (`isExpanded`) Reorganizado**:
    - Al hacer clic en la fila o en la opción del menú, se despliega un panel de detalle estructurado en **3 columnas de metadatos**:
      1. **Fecha**: Fecha registrada de la actividad.
      2. **Estado**: Estado de OpenProject (si aplica) junto al pill de estado de sincronización (`Sincronizado` / `Pendiente`).
      3. **Tipo de actividad**: Tipo de actividad de OpenProject (`activityTypeName` o `projectName`).
    - **Sección de Descripción**: Se renderiza **únicamente** si la actividad contiene una descripción no vacía, respetando saltos de línea (`whitespace-pre-wrap`) y eliminando placeholders redundantes.

### 2.7. Modales de Negocio Totalmente Separados
Cada modal se encuentra aislado en su propio componente standalone dentro de `modals/`:
1. **`app-activity-form-modal`**:
   - Modal dedicado exclusivamente para la creación y edición manual de actividades.
   - **Título de Ticket Editable y Auto-bloqueo**:
     - Campo de entrada editable `<input pInputText>` para el título del ticket.
     - Al ingresar un número de ticket y encontrarlo en OpenProject, el valor del input se reemplaza automáticamente con el título del ticket obtenido y el campo se deshabilita para evitar discrepancias.
     - Si el número de ticket se borra o se cambia por uno no encontrado, el campo vuelve a habilitarse para edición manual libre.
   - **Política de Descripción Vacía**:
     - Si el usuario no ingresa descripción, se guarda vacía (`name = ''`), sin generar textos artificiales ni forzar la copia del título del ticket.
   - **Selector de Tipo de Actividad OpenProject**:
     - El campo **Tipo de Actividad OpenProject** se solicita de forma visible y destacada al registrar la actividad.
     - Si el usuario está conectado a OpenProject, se precarga automáticamente con el primer tipo disponible para agilizar la captura.
     - Al guardarse con su `activityTypeId`, la actividad queda lista para ser enviada a OpenProject.
   - **Sincronización Directa sin Diálogos Redundantes**:
     - Al hacer clic en "Sincronizar a OpenProject" en la fila o en los botones masivos ("Todos" / "Enviar"), el sistema envía las peticiones directamente a la API v3 en formato **HAL+JSON** (`_links.workPackage`, `_links.activity`, y `_links.project`) sin abrir modales innecesarios.
     - El modal `app-sync-confirm-modal` se reserva como fallback en caso de que alguna actividad carezca de tipo asignado.
   - **Soporte de Modo Cronómetro Directo**:
     - Botón "Iniciar Cronómetro" en el pie de la modal para registrar la actividad e iniciar inmediatamente el conteo en tiempo real.
     - Detección inteligente: Si el usuario pulsa "Guardar" con 0 horas y 0 minutos, despliega un diálogo limpio que consulta si desea iniciar el cronómetro o llenar el tiempo manualmente.
   - **Incorpora el componente `Textarea` de PrimeNG (`<textarea pTextarea>`)** al final del formulario para capturar cómodamente descripciones multilínea con autoajuste de tamaño (`[autoResize]="true"`).
   - **Incorpora el componente `DatePicker` de PrimeNG (`<p-datepicker>`)** para la selección nativa de fechas con calendario emergente, eliminando inputs de fecha nativos planos.
   - Utiliza `<p-inputnumber>` para horas y minutos, `<input pInputText>` para el número de ticket y `<p-select>` para la selección de proyectos.
2. **`app-favorites-modal`**:
   - Modal dedicado para listar los tickets favoritos guardados.
   - Al seleccionar un ticket, transfiere los datos automáticamente y abre el formulario de actividad con los campos precargados.
   - Permite eliminar favoritos con un solo clic.
3. **`app-reset-confirm-modal`**:
   - Modal dedicado para la confirmación de reinicio de la jornada.
   - Totalmente desacoplado de la plantilla principal `compact.page.html`.
4. **`app-sync-confirm-modal`**:
   - Modal dedicado para seleccionar el tipo de actividad de OpenProject y enviar tiempos individuales o masivos.
5. **`app-close-confirm-modal`**:
   - Modal dedicado para confirmar el cierre de la aplicación al pulsar el botón de cerrar (`X`) o mediante solicitudes de cierre del sistema.
   - Proporciona opciones limpias para Cancelar, Minimizar a la bandeja (guardar en los iconos ocultos) o Cerrar la aplicación definitivamente.
6. **`app-ticket-context-modal` (Modal de Contexto Extendido de Ticket)**:
   - **Ubicación**: `src/app/modules/compact/modals/ticket-context-modal/ticket-context-modal.component.ts` (+ `.html`).
   - **Dimensiones y Responsividad**:
     - Tamaño mínimo garantizado de `min(94vw, 540px)` de ancho y `min(75vh, 480px)` de alto, con contenedor de pestañas de `min-h-[380px]`.
     - `zIndex` calibrado a 1100 para no solapar ni ocultar el `app-header` nativo.
   - **Pestaña de Detalle (Primera vista predeterminada)**:
     - Panel de 12 metadatos clave organizados en rejilla uniforme: Proyecto, Tipo, Versión, Prioridad, Asignado, Responsable, Fechas (Inicio / Fin), Estimado (formateado con `formatDuration`), Horas Invertidas y Tiempo Registrado Hoy.
     - **Cambio de Estado en Vivo**: Selector interactivo (`<p-select>`) de estados de OpenProject con indicador cromático (`status_color`) y actualización reactiva inmediata con control de concurrencia optimista (`lock_version`).
     - **Flujo de Tableros (Kanban / Action Boards)**: Selectores independientes para elegir el Tablero (`<p-select>`) y la Columna de destino (`<p-select>`), sincronizando el posicionamiento delta y actualizando automáticamente el estado del ticket.
   - **Pestaña de Descripción**:
     - Soporte completo para renderizado Markdown y HTML generado por OpenProject CKEditor.
     - **Imágenes Integradas con Autenticación**: Pre-descarga de imágenes mediante `fetch_attachment_content` de Tauri para eludir restricciones de cookies de sesión, reemplazando fuentes relativas por data URLs en base64 en tiempo real con caché reactivo (`imageCache`).
     - **Lightbox Interactivo**: Al hacer clic en cualquier imagen embebida, se despliega una visualización a pantalla completa con zoom.
   - **Pestaña de Comentarios**:
     - Barra de filtros fija/adherida (*pinned*) en la parte superior (búsqueda por texto y autor), separada de la barra de desplazamiento que se aplica exclusivamente al listado de comentarios (`max-h-72 overflow-y-auto`).
     - Renderizado de comentarios con avatares, fechas relativas y soporte de imágenes inline.
   - **Pestaña de Archivos (Descargas e hipervínculos directos)**:
     - Título estandarizado a **"Archivos"** / **"Files"**.
     - Lista de adjuntos enlazados directamente a la plataforma web de OpenProject (mediante `openUrl`), emulando con fidelidad el comportamiento nativo web.

---

## 3. Barra Inferior y Conmutación de Modo

La barra de navegación inferior (`<nav>`) de 3 posiciones permite la conmutación al Modo Completo:
1. **Botón Izquierdo (Icono de 4 cuadrados `tablerLayoutDashboard`)**:
   - Al pulsar este botón, la ventana se redimensiona al tamaño del dashboard (~1150x780 px) y navega a `/dashboard/overview` vía `WindowService.setFullMode()`.
2. **Botón Central (Icono de historial `tablerHistory`)**:
   - Inactivo / deshabilitado con título "Próximamente" (tal como en la versión original).
3. **Botón Derecho (Icono de ajustes `tablerSettings`)**:
   - Abre la configuración del sistema en Modo Completo (`/dashboard/settings?tab=user`).

---

## 4. Estado Reactivo (Signals) e Integración de Servicios

* **[`WindowService`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/core/services/window.service.ts)**: Control de dimensiones compacta (525x800) vs completa (1150x780), minimizado a la bandeja (iconos ocultos), interceptor de cierre con confirmación (`showCloseModal`) y arrastre nativo.
* **[`ActivityService`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/core/services/activity.service.ts)**:
  - Signals: `activities`, `selectedDate`, `projects`, `favoriteTickets`, `timeFormat`, `isSelectionMode`, `showActivityForm`, `showFavoritesModal`, `showResetModal`, `showSyncModal`, `presetActivity`.
  - Computeds: `dailyActivities`, `totalMinutes`, `progressPercentage`, `unsyncedActivities`, `selectedActivities`.
  - Almacenamiento dual SQLite nativo (`pocketproject.sqlite`) con fallback transparente en `localStorage`.
* **[`StorageService`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/core/services/storage.service.ts)**: Provee la configuración global, nombre de usuario (`userName`) y meta diaria de minutos (`maxDailyMinutes`).

---

## 5. Estándares y Cumplimiento de Reglas

- **Uso estricto de `<button pButton>`**: El componente `<p-button>` se encuentra 100% erradicado de todos los componentes y modales, utilizando la directiva nativa `ButtonDirective`.
- **Degradados y colores del tema**: Cero uso de clases rígidas (`indigo-`, `blue-`); todos los estilos interactivos, degradados y bordes se derivan de variables semánticas `primary-*`.
- **Prioridad Absoluta de Componentes PrimeNG**: Se utilizan `SelectButton`, `DatePicker`, `Popover`, `Select`, `InputNumber`, `InputText` y `Dialog` en lugar de maquetaciones manuales o elementos HTML crudos.
- **Modales Limpios sin Descripciones Redundantes**: Cada modal presenta un encabezado limpio y directo con solo su icono y título, omitiendo párrafos descriptivos y subtítulos innecesarios conforme a las directrices del proyecto.
- **Soporte Completo de i18n / Bilingüe**: Todos los textos, etiquetas, placeholders, mensajes de estado y tooltips del modo compacto consumen las cadenas del diccionario a través de `TranslatePipe` (`| translate`) y `LanguageService`.
- **Verificación**: Compilado y verificado sin errores mediante `bun run build` y `cargo check`.


## Filtrado compartido
- El filtrado y orden de la lista (`filteredActivities`, `hasActiveFilters`) usan `core/utils/activity-filter.util.ts`, compartido con la vista completa `/dashboard/time-entries` (módulo `time-entry`).
