# Módulo: Time Entry (Registro de tiempo en vista completa)

Versión de vista completa del modo compacto: muestra y gestiona las entradas de tiempo locales del día (SQLite) con las mismas acciones, dentro del layout del dashboard.

## Ubicación y ruta

- **Ruta del módulo**: `src/app/modules/time-entry/`
- **Ruta de navegación**: `/dashboard/time-entries` (ruta hija lazy en `dashboard.router.ts`)
- **Barra lateral**: grupo **PocketProject → Registro de tiempo**; breadcrumb `Registro de tiempo`.

```
src/app/modules/time-entry/
├── components/
│   └── time-entry-summary/time-entry-summary.component.ts  # Fila de indicadores del día
├── pages/
│   ├── time-entry.page.html   # Encabezado con fecha, indicadores y lista
│   └── time-entry.page.ts     # Smart component: filtros, fecha, sincronización
└── time-entry.router.ts
```

## Diseño (aprovecha el ancho de la vista completa)

- **Encabezado**: la fecha seleccionada como título (con etiqueta **Hoy**), navegación **Hoy** (solo fuera de hoy, a la izquierda) / día anterior / `p-datepicker` / día siguiente, y las acciones **Favoritos** y **Añadir**. Sin saludo.
- **Indicadores (`app-time-entry-summary`)**, 3 tarjetas desde `md`:
  - **Total registrado** con conmutador HH:MM / decimal (`p-selectbutton`) en la cabecera y **Reiniciar** el día a la derecha del total.
  - **Meta del día**: objetivo de la fecha seleccionada según el horario (`StorageService.targetMinutesFor`), barra de progreso y texto de restante / cumplido / extras; "Día no laboral" si el día está desactivado.
  - **Pendiente por sincronizar**: tiempo pendiente con **Sincronizar todo** a su derecha y el número de registros pendientes debajo.
- **Lista**: búsqueda, filtros visibles (proyecto, orden, estado), limpiar filtros, modo selección con **Enviar (n)**, y filas `app-activity-row` con todas sus acciones. El estado vacío incluye **Añadir**.

## Reutilización

- Todo el estado vive en `ActivityService` (fecha seleccionada, actividades, selección, modales), así que la vista comparte datos con el modo compacto.
- Reutiliza los componentes del módulo `compact`: `ActivityRowComponent` y los modales `ActivityFormModalComponent`, `FavoritesModalComponent`, `SyncConfirmModalComponent`, `ResetConfirmModalComponent` y `TicketContextModalComponent`.
- El filtrado/orden se comparte con el modo compacto mediante `core/utils/activity-filter.util.ts` (`filterActivities`, `hasActiveActivityFilters`).

## Notificaciones

- Las acciones muestran toasts (`NotificationService`, `core/services/notification.service.ts`, sobre `MessageService` global y `<p-toast position="bottom-right">` en el dashboard): crear/editar/eliminar actividad, reiniciar el día, sincronizar (individual o resumen de sincronización masiva con éxitos/errores), favoritos, y cambios de estado, versión o columna. Los textos están en `toast.*` de los idiomas. El modo compacto no monta `<p-toast>`, así que ahí no aparecen.
