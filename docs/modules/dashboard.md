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

### 2.1. Barra Lateral de Navegación (`p-sidebar`)
- Implementa `p-sidebar-layout` y `p-sidebar` de PrimeNG con soporte responsivo (`offcanvas` para pantallas móviles, colapso de icono para escritorio).
- Navegación limpia y directa sin elementos innecesarios:
  - **Resumen** (`/dashboard/overview`): Acceso a la vista general de jornada diaria, métricas y calendario semanal.
  - **Configuración** (`/dashboard/settings`): Acceso al módulo de ajustes por pestañas (User y System).
- Pie de barra lateral con perfil de usuario: iniciales computadas (`userInitials`), nombre y modo visual actual; al hacer clic redirige directamente a `/dashboard/settings?tab=user`.

### 2.2. Menú Superior / Topbar (`<header>`)
- Botón disparador para expandir o colapsar el sidebar (`pSidebarTrigger target="preview"`).
- Etiqueta dinámica de la vista activa (`activeNavLabel`).
- Botón de refresco reactivo (`tablerRefresh`) que dispara `storageService.reloadConfig()`.
- Conmutador rápido de tema claro/oscuro (`tablerSun` / `tablerMoon`) sincronizado con `ThemeService`.
- Acceso directo al módulo de configuración (`/dashboard/settings`).

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
