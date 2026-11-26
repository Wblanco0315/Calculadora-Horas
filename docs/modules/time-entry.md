# Módulo: Time Entry (Registro de tiempo en vista completa)

Versión de vista completa del modo compacto: muestra y gestiona las entradas de tiempo locales del día (SQLite) con las mismas acciones, dentro del layout del dashboard.

## Ubicación y ruta

- **Ruta del módulo**: `src/app/modules/time-entry/`
- **Ruta de navegación**: `/dashboard/time-entries` (ruta hija lazy en `dashboard.routes.ts`)
- **Barra lateral**: grupo **PocketProject → Registro de tiempo**; breadcrumb `Registro de tiempo`.

```
src/app/modules/time-entry/
├── components/
│   ├── activity-row/          # Fila de actividad (compartida con el modo compacto)
│   └── time-entry-summary/    # Fila de indicadores del día
├── modals/                    # Modales de actividad compartidos con el modo compacto
│   ├── activity-form-modal/
│   ├── favorites-modal/
│   ├── reset-confirm-modal/
│   └── sync-confirm-modal/
├── pages/
│   └── time-entry/time-entry.page.{ts,html}  # Smart component: filtros, fecha, sincronización
└── time-entry.routes.ts
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
- Este módulo es el dueño de los componentes de actividad (`ActivityRowComponent`, `ActivityFormModalComponent`, `FavoritesModalComponent`, `SyncConfirmModalComponent`, `ResetConfirmModalComponent`); el modo compacto y el detalle de ticket los importan desde aquí. Los favoritos viven en `FavoriteService` (`core/services/favorite.service.ts`). Usa también `TicketDetailPage` (módulo board) dentro del drawer.
- El filtrado/orden se comparte con el modo compacto mediante `core/utils/activity-filter.util.ts` (`filterActivities`, `hasActiveActivityFilters`).

## Contexto del ticket y notificaciones

- La acción de contexto del ticket de cada fila abre un `p-drawer` lateral derecho (ancho completo en móvil, 44rem desde `md`; dentro, el detalle se muestra en una sola columna con la actividad debajo: `.ticket-detail-page--embedded`) con la página de detalle del ticket (`TicketDetailPage` con `[ticket]` y `[embedded]="true"`). En modo embebido la página no publica el breadcrumb, no monta su propio modal de actividad (usa el de esta vista) y su botón de volver (icono X) cierra el drawer. El encabezado del drawer se oculta (`.ticket-detail-drawer` en `styles.css`) porque la página trae el suyo; el drawer y su máscara empiezan debajo de la barra de título de la ventana (`--app-header-height`, 2rem) para no taparla. El modo compacto sigue usando el modal de contexto.
- Las acciones muestran toasts (`NotificationService`, `core/services/notification.service.ts`, sobre `MessageService` global y `<p-toast position="bottom-right">` en el dashboard): crear/editar/eliminar actividad, reiniciar el día, sincronizar (individual o resumen de sincronización masiva con éxitos/errores), favoritos, y cambios de estado, versión o columna. Los textos están en `toast.*` de los idiomas. El modo compacto no monta `<p-toast>`, así que ahí no aparecen.
