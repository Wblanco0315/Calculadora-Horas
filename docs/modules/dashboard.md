# Módulo: Dashboard (Contenedor Principal / Layout Shell)

El módulo `dashboard` actúa **exclusivamente como el contenedor estructural y layout principal** de la aplicación autenticada en **PocketProject**. Aloja la barra lateral colapsable (`p-sidebar`), el menú superior (`<header>`) y el área de proyección de vistas secundarias mediante `<router-outlet />`.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/dashboard/`
- **Ruta Base de Navegación**: `/dashboard` (definida en `dashboard.router.ts`)

```
src/app/modules/dashboard/
├── pages/
│   ├── dashboard.page.html   # Shell estructural: Sidebar + Menú superior + <router-outlet />
│   ├── dashboard.page.ts     # Componente layout con Signals de estado y navegación
│   └── dashboard.page.css    # Estilos del contenedor principal
└── dashboard.router.ts       # Enrutamiento con rutas hijas (children: overview, etc.)
```

---

## 2. Responsabilidades Arquitectónicas

### 2.0. Barra Superior del Sistema (`app-header`)
- Integra el componente reutilizable `app-header` como barra de título frameless (altura estándar Windows de 32px), garantizando arrastre suave (`startDragging`), conmutador de tema, comprobación de actualizaciones, controles de ventana (minimizar a bandeja, maximizar/restaurar con doble clic o botón) y disparador de cierre con confirmación.
- Incluye el diálogo modal de confirmación de cierre (`app-close-confirm-modal`).

### 2.1. Barra Lateral de Navegación (`p-sidebar`)
- Implementa `p-sidebar-layout` y `p-sidebar` de PrimeNG con soporte responsivo (`offcanvas` para pantallas móviles, colapso de icono para escritorio).
- Encabezado con el isologo oficial (`app-logo`), nombre de la aplicación y enlace directo al resumen general.
- Navegación agrupada por secciones (`navGroups`):
  - **PocketProject** (funcionalidades propias): **Resumen** (`/dashboard/overview`), **Registro de tiempo** (`/dashboard/time-entries`, ver `time-entry.md`) y **Modo compacto** (`WindowService.setCompactMode()`).
  - **OpenProject** (datos de la plataforma): **Proyectos** y **Reportes** (`/dashboard/reports`).
- **Proyectos** es un `p-sidebar-menu-item collapsible` cuyo submenú lista los proyectos de OpenProject (`sidebarProjects`, cargados una sola vez al abrirlo y ordenados por nombre). Cada proyecto es un `pSidebarMenuSubButton` que navega a su listado de tableros (`/dashboard/boards/:projectId`); los tableros ya no se anidan en la barra lateral. Al entrar a un proyecto o tablero por URL, un `effect` expande Proyectos y resalta el proyecto activo (`activeBoardRoute`). En modo icono, abrir Proyectos expande primero la barra lateral.
- Pie de barra lateral: botón de cuenta (`pSidebarMenuButton` con `p-avatar`, nombre e icono `tablerSelector`) que abre un `p-menu` emergente (`[popup]="true"`, `appendTo="body"`). El modelo `accountMenuItems` usa el nombre del usuario como encabezado de grupo nativo de PrimeNG y las opciones **Usuario** (`/dashboard/settings?tab=user`) y **Sistema** (`?tab=system`). La plantilla `#item` solo sustituye el icono por `ng-icon`, conservando las clases `p-menu-item-link`, `p-menu-item-icon` y `p-menu-item-label`.

### 2.2. Menú Superior / Topbar (`<header>`)
- Botón disparador para expandir o colapsar el sidebar (`pSidebarTrigger target="preview"`).
- Etiqueta dinámica de la vista activa (`activeNavLabel`).
- Botón de refresco reactivo (`tablerRefresh`) que dispara `storageService.reloadConfig()`.
- Conmutador rápido de tema claro/oscuro (`tablerSun` / `tablerMoon`) sincronizado con `ThemeService`.
- Los ajustes ya no tienen botón en el menú superior: se acceden desde el colapsable del pie de la barra lateral.

### 2.3. Contenedor de Vistas Hijas (`<router-outlet />`)
- El HTML de `DashboardPage` **no contiene lógica ni maquetación de negocio directa**.
- Todo contenido corresponde a componentes de módulo independientes cargados como rutas secundarias (`children` en `dashboard.router.ts`), soportando `overview` y `settings`.

---

## 3. Estado Reactivo e Inyección de Servicios

El componente utiliza Signals inyectados mediante `inject()`:
- `isMobile`: Detección reactiva de pantalla móvil mediante `window.matchMedia`.
- `open`: Control de apertura/cierre de la barra lateral.
- `isLoading`: Signal reactivo proveniente de `StorageService.isLoading` que anima el icono de refresco.
- `config`, `todaySchedule`, `workingDaysCount`: Signals de `StorageService` para metadatos del sidebar.
- `themeService`: Gestión reactiva de tema visual.
- `languageService`: Internacionalización de etiquetas de navegación.

## Breadcrumb de proyectos y tableros
- En rutas `/dashboard/boards/...` el breadcrumb muestra `Proyectos > {proyecto} > Tableros > {tablero} > #{ticket}` (`boardBreadcrumbItems`). El proyecto y "Tableros" enlazan al listado de tableros del proyecto; el tablero enlaza al tablero cuando se está en un ticket. Los nombres salen de los proyectos del sidebar y, solo cuando la ruta incluye un tablero, de los tableros del proyecto (`projectBoards`, cargados bajo demanda) con respaldo en los query params `name`/`identifier`.

## Buscador de la barra lateral
- En la cabecera de la barra lateral hay un `p-iconfield` + `pInputText` (`sidebarQuery`). Filtra, sin distinguir acentos ni mayúsculas, las entradas de navegación (`visibleNavGroups`) y los proyectos por nombre o identificador (`filteredSidebarProjects`); al escribir se cargan los proyectos y el menú Proyectos se abre mientras haya búsqueda.
- Si el texto es un número (`123` o `#123`), aparece primero **Ir al ticket #123** (`searchTicketId`). `openTicket` carga el contexto mínimo del ticket para conocer su proyecto, busca entre los tableros del proyecto el que tiene el ticket en alguna columna (columnas cacheadas, consultadas en paralelo) y navega a `/dashboard/boards/:projectId/:boardId/tickets/:id`, así el breadcrumb queda `Proyectos > {proyecto} > Tableros > {tablero} > #id`. Si ningún tablero lo contiene, abre `/dashboard/tickets/:id?projectId=...` y el breadcrumb muestra `Proyectos > {proyecto} > Tableros > #id`. Mientras resuelve, el botón muestra un spinner. `Enter` abre el ticket o, si no es un número, el primer proyecto o entrada que coincida; `Esc` limpia la búsqueda.
- En modo icono se muestra un botón de búsqueda que expande la barra lateral.
- `/dashboard/tickets/:ticketId` (`ticketRoutes` del módulo board) muestra el detalle del ticket sin contexto de tablero; el breadcrumb muestra `#id` y el botón volver lleva al listado de tableros del proyecto del ticket.
- El último nivel del breadcrumb de un ticket es `#id asunto`: `TicketDetailPage` publica el asunto en `BreadcrumbService.ticket` (`core/services/breadcrumb.service.ts`) y lo limpia al destruirse; mientras carga solo se muestra `#id`. La etiqueta final se trunca con `title` para asuntos largos.
- Coincidencias de tickets: mientras hay texto, el grupo **Tickets** lista hasta 8 paquetes de trabajo que coinciden por asunto o ID (`OpenprojectService.searchWorkPackages`, filtro `typeahead` de OpenProject, más recientes primero; comando Tauri `search_work_packages`). La petición sale 350 ms después de la última tecla (`debounceTime`) y `switchMap` descarta respuestas viejas; los textos necesitan al menos 2 caracteres y los IDs se buscan desde el primer dígito. Cada coincidencia muestra `#id asunto` y proyecto · estado, y al hacer clic se abre con `openTicket` (resuelve proyecto y tablero). **Ir al ticket #id** solo aparece si ese ID no está entre las coincidencias. `Enter` sin número abre el primer proyecto, luego la primera entrada del menú y, si no hay, el primer ticket.
- El shell monta `<p-toast position="bottom-right" />` para las notificaciones de `NotificationService` (`MessageService` se provee globalmente en `app.config.ts`).
