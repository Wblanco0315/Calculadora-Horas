# Módulo: Compact (Modo Compacto / Calculadora de Horas)

El módulo `compact` replica fielmente la vista original de la **Calculadora de Horas** de PocketProject adaptada a la arquitectura de Angular 22+, PrimeNG y Tailwind CSS v4. Funciona como la interfaz de escritorio compacta (tamaño original de 525x800 px) para registrar, gestionar y sincronizar actividades diarias de tiempo con OpenProject.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/compact/`
- **Ruta de Navegación**: `/compact`

```
src/app/modules/compact/
├── components/
│   ├── compact-header/
│   │   └── compact-header.component.ts       # Barra de título nativa arrastrable con controles de ventana
│   ├── stats-hero/
│   │   └── stats-hero.component.ts           # Panel de estadísticas con SelectButton y degradado dinámico de tema
│   └── activity-row/
│       └── activity-row.component.ts         # Fila de actividad (ticket, tiempo, confirmación inline de borrado, sincronización)
├── modals/
│   ├── activity-form-modal/
│   │   └── activity-form-modal.component.ts  # Modal dedicado para crear/editar actividades (con p-datepicker y p-inputnumber)
│   ├── favorites-modal/
│   │   └── favorites-modal.component.ts      # Modal dedicado para gestión y selección rápida de tickets favoritos
│   ├── reset-confirm-modal/
│   │   └── reset-confirm-modal.component.ts  # Modal dedicado para confirmación de reinicio de actividades del día
│   └── sync-confirm-modal/
│       └── sync-confirm-modal.component.ts   # Modal dedicado para seleccionar tipo de actividad y sincronizar a OpenProject
├── pages/
│   ├── compact.page.html                     # Vista orquestadora limpia con saludo, popover de filtros y navegación
│   ├── compact.page.ts                       # Smart component con filtrado reactivo y gestión de estado
│   └── compact.page.css                      # Estilos encapsulados de la vista
└── compact.router.ts                         # Enrutador del módulo con carga diferida
```

---

## 2. Componentes Clave y Réplica Fiel

### 2.1. Barra de Título (`app-compact-header`)
- **Ubicación**: `components/compact-header/compact-header.component.ts`
- **Responsabilidad y Diseño**:
  - Altura nativa de 32px (`h-8`), coincidiendo con la barra de título original de Windows.
  - Región arrastrable (`data-tauri-drag-region`) con el logo cuadrado dinámico en degradado del tema (`from-primary-500 to-primary-700`), título de la aplicación y versión actual (`v{{ version }}`).
  - Botón de alternancia de tema claro/oscuro (`tablerSun` / `tablerMoon`) y botones nativos de minimizar y cerrar con comportamiento visual de Windows.

### 2.2. Panel de Estadísticas Hero (`app-stats-hero`)
- **Ubicación**: `components/stats-hero/stats-hero.component.ts`
- **Integración PrimeNG y Diseño**:
  - Degradado que utiliza **exclusivamente tokens primarios dinámicos del tema seleccionado**: `bg-linear-to-b from-primary-500 to-primary-600 dark:from-primary-950 dark:to-zinc-900 text-white`.
  - Encabezado con etiqueta "TOTAL REGISTRADO" y "Meta del día: HH:MM / decimal".
  - Contador numérico prominente en fuente monoespaciada (`JetBrains Mono`) con botón "Reiniciar" (`<button pButton>` con `ButtonDirective`) que dispara el modal dedicado `app-reset-confirm-modal`.
  - **Uso Oficial de `SelectButton` de PrimeNG (`<p-selectbutton>`)** para el conmutador de formato `[ HH:MM | DECIMAL ]`, permitiendo alternar reactivamente el formato de horas en toda la aplicación.
  - Indicador de estado reactivo: "¡Meta cumplida! X extras", "¡Meta cumplida!" o "X restantes".
  - Barra de progreso delgada (`h-1.5`) de alto contraste con fondo semitransparente y relleno blanco.

### 2.3. Barra de Saludo y Acciones Rápidas
- **Ubicación**: En `compact.page.html` (bajo el hero).
- **Diseño**:
  - Subtítulo `REGISTRO DEL DÍA` y saludo `Hola, {{ currentUserName() }} 👋`.
  - Botón **"Favoritos"**: Abre directamente el modal independiente de favoritos (`app-favorites-modal`) mediante `<button pButton>` con icono de estrella dorada.
  - Botón **"Añadir"**: Botón primario (`<button pButton>`) con icono de suma que abre el modal independiente de actividad (`app-activity-form-modal`).

### 2.4. Barra de Búsqueda, Filtros con Popover y Sincronización
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

### 2.5. Lista y Fila de Actividad (`app-activity-row`)
- **Ubicación**: `components/activity-row/activity-row.component.ts`
- **Responsabilidad y Comportamiento**:
  - Checkbox para selección rápida cuando el modo de selección está habilitado.
  - Barra de acento lateral reactiva: verde esmeralda (`bg-emerald-500`) para tareas sincronizadas, color primario (`bg-primary-500`) para pendientes y rojo rosa (`bg-rose-500`) al confirmar eliminación.
  - Badge de ticket `#12345` con borde temático y etiqueta de proyecto con icono de carpeta.
  - Contador de tiempo en fuente monoespaciada formateado según el modo activo (`HH:MM` o decimal).
  - Acciones rápidas:
    - Copiar nombre al portapapeles con confirmación visual de copiado.
    - Editar actividad.
    - Eliminar actividad con **confirmación inline dentro de la propia fila** (`¿Eliminar actividad? [Aceptar] [Cancelar]`), replicando fielmente `row.vue`.
    - Indicador/botón de sincronización con estado persistente sincronizado.

### 2.6. Modales de Negocio Totalmente Separados
Cada modal se encuentra aislado en su propio componente standalone dentro de `modals/`:
1. **`app-activity-form-modal`**:
   - Modal dedicado exclusivamente para la creación y edición manual de actividades.
   - **Incorpora el componente `DatePicker` de PrimeNG (`<p-datepicker>`)** para la selección nativa de fechas con calendario emergente, eliminando inputs de fecha nativos planos.
   - Utiliza `<p-inputnumber>` para horas y minutos, `<input pInputText>` para ticket y descripción, y `<p-select>` para la selección de proyectos.
2. **`app-favorites-modal`**:
   - Modal dedicado para listar los tickets favoritos guardados.
   - Al seleccionar un ticket, transfiere los datos automáticamente y abre el formulario de actividad con los campos precargados.
   - Permite eliminar favoritos con un solo clic.
3. **`app-reset-confirm-modal`**:
   - Modal dedicado para la confirmación de reinicio de la jornada.
   - Totalmente desacoplado de la plantilla principal `compact.page.html`.
4. **`app-sync-confirm-modal`**:
   - Modal dedicado para seleccionar el tipo de actividad de OpenProject y enviar tiempos individuales o masivos.

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

* **[`WindowService`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/core/services/window.service.ts)**: Control de dimensiones compacta (525x800) vs completa (1150x780), minimizado, cierre y arrastre.
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
