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
  - **PocketProject** (funcionalidades propias): **Resumen** (`/dashboard/overview`) y **Modo compacto** (`WindowService.setCompactMode()`).
  - **OpenProject** (datos de la plataforma): **Proyectos** y **Reportes** (`/dashboard/reports`).
- **Proyectos** es un árbol de `p-sidebar-menu-item collapsible` anidados: Proyectos → proyecto → tableros. Al abrir Proyectos se cargan los proyectos de OpenProject (`sidebarProjects`, una sola vez, ordenados por nombre). Al abrir un proyecto se cargan sus tableros bajo demanda (`projectBoards`, vía `getProjectBoards`, cacheado en el servicio) y cada tablero navega a `/dashboard/boards/:projectId/:boardId`. Al entrar a un tablero por URL, un `effect` expande Proyectos y el proyecto activo (`activeBoardRoute`) y resalta el tablero. En modo icono, abrir Proyectos expande primero la barra lateral.
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
