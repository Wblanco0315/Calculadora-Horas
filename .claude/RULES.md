# Project Rules & Development Standards

Este documento establece las reglas obligatorias de desarrollo, gestión de paquetes, nomenclatura, uso de skills descargadas y organización de carpetas para el proyecto en Angular 22+, PrimeNG, Tailwind CSS y Tauri.

---

## 1. Gestor de Paquetes: Uso Exclusivo de Bun

- **Runtime y Package Manager Oficial**: Se utiliza **Bun** exclusivamente para todas las operaciones del proyecto.
- **Comandos Permitidos**:
  - Instalar dependencias: `bun install` o `bun add <paquete>` / `bun add -d <paquete>`
  - Ejecutar scripts: `bun run start`, `bun run build`, `bun run watch`, `bun test`, etc.
  - Ejecutar binarios o scaffolding: `bunx <comando>`
- **Comandos Prohibidos**: Queda estrictamente prohibido el uso de `npm`, `npx`, `yarn` o `pnpm`.
- **Verificación de Compilación**: Antes de dar por finalizada cualquier tarea o cambio de código, se debe verificar ejecutando:
  ```bash
  bun run build
  ```

---

## 2. Convenciones de Nomenclatura: Siempre en Inglés y en Singular

- **Idioma Único**: Todo el código fuente (nombres de archivos, carpetas, clases, interfaces, tipos, funciones, métodos, variables, constantes, comentarios técnicos y documentación) debe estar escrito estrictamente en **inglés**.
  - *Única excepción*: Los archivos dentro de `shared/lang/es/` (e.g., `permission.ts`, `field-names.ts`), cuyo propósito explícito es mapear valores del sistema a etiquetas legibles en español para la interfaz de usuario.
- **Siempre en Singular**:
  - Nombres de archivos: en kebab-case y en singular (ejemplo: `user.service.ts`, `auth.guard.ts`, `product.component.ts`, `session.state.ts`, `table.interface.ts`; nunca en plural como `users.service.ts` o `products.component.ts`).
  - Nombres de clases, tipos e interfaces: en PascalCase y en singular (ejemplo: `User`, `Account`, `Product`, `AuthService`, `SessionState`; nunca `Users` o `Products`).
  - Nombres de métodos y variables: en camelCase y en singular cuando representen una entidad única o acción sobre una entidad (ejemplo: `getUser()`, `findProduct()`, `isAuthorized`).
  - Nombres de módulos de negocio: las carpetas de módulos dentro de `src/app/modules/` deben nombrarse en singular (ejemplo: `modules/user/`, `modules/account/`, `modules/product/`).

---

## 3. Uso Obligatorio de Skills Descargadas

Todo agente o asistente que genere, refactorice o mantenga código en este repositorio DEBE consultar y aplicar estrictamente las directrices contenidas en las skills instaladas en `.agents/skills/` (y vinculadas en `.claude/skills/`):

### 3.1. `angular-developer` (`skills/angular-developer/SKILL.md`)
- **Versión de Angular**: Desarrollar bajo los estándares de Angular 22+.
- **Componentes Standalone**: Todos los componentes, directivas y pipes deben ser `standalone: true`.
- **Inyección de Dependencias**: Usar exclusivamente la función `inject()` (`private readonly service = inject(MyService);`). Prohibida la inyección por constructor.
- **Reactividad con Signals**:
  - Utilizar Signals (`signal()`, `computed()`, `effect()`, `linkedSignal()`) como mecanismo principal de reactividad y estado local en componentes.
  - Para comunicación asíncrona o recursos HTTP, preferir `resource()` / `httpResource()` o Signals en lugar de suscripciones manuales a observables.
  - Si se utiliza RxJS, evitar suscripciones manuales sin desuscribir; utilizar `toSignal()`, `toObservable()`, `takeUntilDestroyed()` o el pipe `async`.
- **Inputs y Outputs Modernos**:
  - Declarar inputs mediante `input()` o `input.required()`.
  - Declarar outputs mediante `output()`.
  - Prohibido el uso de decoradores legacy `@Input()` y `@Output()`.
- **Sintaxis de Control Flow Nativo en Templates**:
  - Usar la sintaxis de bloque integrada: `@if`, `@else if`, `@else`, `@for (item of items; track item.id)`, `@switch`, `@let`.
  - Prohibido el uso de directivas estructurales legacy como `*ngIf`, `*ngFor` y `*ngSwitch`.
  - Emplear `@defer` para carga diferida de vistas y componentes secundarios.
- **Gestión de Carga mediante `@defer` (Evitar Signals de `isLoading` Innecesarios)**:
  - Para vistas y componentes diferidos, **no crear estados booleanos manuales** (e.g., `isLoading = signal(true)`) ni condicionales `@if (isLoading())`.
  - Utilizar directamente bloques `@defer` junto con `@placeholder (minimum ...)` y `@loading (after ...; minimum ...)` para mostrar los esqueletos (`<p-skeleton>`).
  - Esto garantiza code-splitting automático nativo en chunks independientes (vía Angular CLI), carga progresiva, prefetching (`prefetch on idle`) y previene parpadeos de interfaz sin boilerplate en la clase TypeScript.
- **Formularios**:
  - Utilizar Signal Forms o Reactive Forms estrictamente tipados.
- **Guards y Resolvers Funcionales**:
  - Todos los route guards deben ser funcionales con la firma `CanActivateFn`.
  - Prohibido el uso de clases que implementen interfaces deprecadas como `CanActivate`.
- **Verificación Obligatoria de Compilación**:
  - Tras generar o modificar código, verificar que no existan errores ejecutando `bun run build`.

### 3.2. `angular-best-practices-primeng` (`skills/angular-best-practices-primeng/SKILL.md`)
- **Suite de Componentes Exclusiva y Prioridad Mandatoria**: PrimeNG es la librería UI oficial del proyecto. Prohibido usar o mezclar con Angular Material, Spartan UI u otras bibliotecas de componentes.
- **PRIORIZAR SIEMPRE LOS COMPONENTES DE PRIME NG**: En caso de existir un componente oficial de PrimeNG que cumpla con las necesidades (por ejemplo: Stepper, Table, Select, Button, InputText, InputNumber, Dialog, Tag, Tabs, Menu, etc.), **SE DEBE USAR PRIMERO ESE COMPONENTE DE PRIME NG** en lugar de construir componentes manuales o maquetaciones HTML personalizadas desde cero.
- **Tree-Shaking Estricto**:
  - Importar siempre los componentes de PrimeNG de forma granular y directa desde su submódulo correspondiente (e.g., `import { ButtonModule } from 'primeng/button';` o `import { StepperModule } from 'primeng/stepper';`).
  - No realizar importaciones monolíticas.
- **Tablas de Alto Rendimiento (`p-table`)**:
  - Configurar las tablas con lazy loading (`[lazy]="true"`), paginación en servidor y virtual scrolling cuando corresponda para optimizar el rendimiento.
- **Sistema de Temas y Tokens**:
  - Trabajar con la configuración temática basada en `@primeuix/themes` (Aura / Lara) y diseño por tokens.
  - Respetar la compatibilidad de estilos con Tailwind CSS v4.

---

## 4. Estructura y Gestión de Carpetas

La aplicación sigue una arquitectura modular y escalable dentro de `src/app/`, dividida en `core/`, `modules/` y `shared/`:

```
src/app/
├── core/
│   ├── guards/         # AuthGuard, noAuthGuard, permissionGuard (all functional CanActivateFn)
│   ├── interceptors/   # api-prefix-interceptor, auth-interceptor, error-interceptor (class-based HttpInterceptor)
│   ├── pipes/          # clean-word, custom-currency, custom-percentage, data-type-table, field,
│   │                   # getter-property, permission
│   ├── services/       # HttpService, StorageService, AuthService, TokenService, ServicesAndPermissionService,
│   │                   # AlertService, LoadingService, FormService, ImageService, DragDropService, OverlayService,
│   │                   # RedirectService, ReloadPageService, SelectService, TableService, TitleService,
│   │                   # SessionService, ApplicationService
│   ├── interfaces/     # http-options, page, select, table, validator, session, application
│   ├── state/          # session.state.ts — Angular signals (sessionExpiredAlertShown, sessionExpiredAlertShownTwo)
│   └── utils/          # end-points.ts (EndPoints const enum), const.ts, custom-validators.ts,
│                       # utils.class.ts, lang.ts, request-permission.ts
├── modules/
│   ├── module/
│          ├── interfaces/
│          ├── services/
│          ├── pages/
│          ├── modals/
│          ├── module.router.ts
└── shared/
    ├── layouts/        # table, forms-filter, loading, loading-modal, delete-confirm,
    │                   # sidebar, topbar, application-selector, progress-bar
    ├── directives/     # click-outside, field-errors, input-mask (3 variants), input-trim,
    │                   # only-number-dot, password, toast-message
    ├── pipes/          # format-hour
    ├── format/         # format.ts (currency/percentage cleanup, date helpers)
    └── lang/es/        # permission.ts (permission key → Spanish name), field-names.ts (form field → Spanish name)
```

### 4.1. Directorio `core/` (Núcleo y Servicios Globales Singleton)
Contiene elementos que existen una sola vez en toda la aplicación (servicios singleton, infraestructura, configuración y estado global). No debe depender de módulos de negocio.

- **`guards/`**:
  - Guards de autenticación y permisos de rutas funcionales (`CanActivateFn`).
  - Ejemplos: `auth.guard.ts`, `no-auth.guard.ts`, `permission.guard.ts`.
  - Regla: Todos deben ser funciones puras / funcionales (`export const authGuard: CanActivateFn = ...`).
- **`interceptors/`**:
  - Interceptores HTTP para peticiones salientes y respuestas entrantes.
  - Ejemplos: `api-prefix-interceptor`, `auth-interceptor`, `error-interceptor`.
- **`pipes/`**:
  - Pipes transversales de transformación de datos para el core.
  - Ejemplos: `clean-word`, `custom-currency`, `custom-percentage`, `data-type-table`, `field`, `getter-property`, `permission`.
- **`services/`**:
  - Servicios singleton con `{ providedIn: 'root' }`.
  - Ejemplos: `HttpService`, `StorageService`, `AuthService`, `TokenService`, `ServicesAndPermissionService`, `AlertService`, `LoadingService`, `FormService`, `ImageService`, `DragDropService`, `OverlayService`, `RedirectService`, `ReloadPageService`, `SelectService`, `TableService`, `TitleService`, `SessionService`, `ApplicationService`.
- **`interfaces/`**:
  - Modelos y contratos de infraestructura y API globales.
  - Ejemplos: `http-options`, `page`, `select`, `table`, `validator`, `session`, `application`.
- **`state/`**:
  - Manejo de estado reactivo global utilizando exclusivamente Angular Signals.
  - Ejemplo: `session.state.ts` con signals como `sessionExpiredAlertShown`, `sessionExpiredAlertShownTwo`.
- **`utils/`**:
  - Constantes, enumeraciones de endpoints y utilidades de soporte.
  - Ejemplos: `end-points.ts` (con `EndPoints` const enum), `const.ts`, `custom-validators.ts`, `utils.class.ts`, `lang.ts`, `request-permission.ts`.

### 4.2. Directorio `modules/` (Módulos de Funcionalidad / Negocio)
Cada funcionalidad o dominio de negocio se aísla dentro de su propio subdirectorio en singular en `modules/<module>/` con la siguiente estructura interna obligatoria:

- **`interfaces/`**: Modelos, DTOs y tipos de datos exclusivos del módulo (en singular e inglés).
- **`services/`**: Servicios de lógica de negocio y llamadas a la API correspondientes a este módulo.
- **`pages/`**: Componentes de página (smart components) que corresponden a las vistas enrutadas.
- **`modals/`**: Componentes de ventana modal o diálogos pertenecientes a este módulo.
- **`<module>.router.ts`**: Configuración de rutas del módulo mediante carga diferida (`Routes`).

### 4.3. Directorio `shared/` (Componentes y Utilidades Reutilizables)
Elemento reusables entre diferentes módulos sin lógica ni estado de negocio acoplado.

- **`layouts/`**:
  - Componentes de diseño, maquetación y estructuras UI reutilizables.
  - Ejemplos: `table`, `forms-filter`, `loading`, `loading-modal`, `delete-confirm`, `sidebar`, `topbar`, `application-selector`, `progress-bar`.
- **`directives/`**:
  - Directivas para comportamiento y manipulación del DOM / inputs.
  - Ejemplos: `click-outside`, `field-errors`, `input-mask` (3 variantes), `input-trim`, `only-number-dot`, `password`, `toast-message`.
- **`pipes/`**:
  - Pipes de presentación compartidos.
  - Ejemplo: `format-hour`.
- **`format/`**:
  - Funciones utilitarias puras de transformación y formateo (`format.ts`: limpieza de moneda/porcentajes, formateadores de fechas).
- **`lang/es/`**:
  - Archivos de internacionalización y mapeo en español.
  - Ejemplos: `permission.ts` (mapeo de clave de permiso a nombre legible en español), `field-names.ts` (mapeo de identificador de campo de formulario a nombre legible en español).

### 4.4. Arquitectura del Dashboard como Contenedor Principal (Shell / Layout)
- **Rol Exclusivo de Contenedor**: El componente `DashboardPage` (`src/app/modules/dashboard/pages/dashboard.page.ts`) actúa **única y exclusivamente como contenedor principal y layout estructural** de la aplicación.
- **Elementos que Habitan en el Dashboard**:
  1. **Barra Lateral (`p-sidebar`)**: Navegación agrupada, badges de estado reactivos, acciones rápidas y perfil de usuario con avatar en el footer.
  2. **Menú Superior / Barra Superior (`<header>`)**: Control de alternancia (toggle) del sidebar (`pSidebarTrigger`), título de la sección activa (`activeNavLabel`), botón de refresco reactivo, conmutador rápido de tema claro/oscuro y acceso directo a configuración.
  3. **Área de Proyección de Contenido (`<main>`)**: Contenedor principal que aloja el `<router-outlet />` donde se renderizan las vistas hijas.
- **Separación Obligatoria del Contenido en Componentes Separados**:
  - **Queda estrictamente prohibido incrustar contenido de negocio, tarjetas, calendarios o paneles directamente en `dashboard.page.html`**.
  - **Cada contenido es un componente separado e independiente**: Todas las pantallas o paneles (por ejemplo, el resumen general `OverviewPage` en `modules/overview/`, vistas de proyectos, tareas o métricas) deben existir en sus propios componentes o páginas modulares.
  - **Enrutamiento por Vistas Hijas**: `dashboard.router.ts` define las rutas secundarias mediante la propiedad `children`, cargando cada contenido con `loadChildren` o `loadComponent`.
  - **Autonomía y Modularidad**: Cada componente de contenido administra sus propios Signals, inyección de dependencias (`inject()`), estados de carga (`p-skeleton`), acciones y subcomponentes en su directorio `components/`.

---

## 5. Reglas de Diseño y Sistema Visual

El sistema de diseño y las reglas de interfaz se encuentran formalmente especificados en [`docs/DESIGN_RULES.md`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/docs/DESIGN_RULES.md). Todo desarrollador o agente debe respetar:

- **Prioridad Absoluta de PrimeNG**: Siempre utilizar componentes de PrimeNG (`Select`, `InputNumber`, `Button`, `DatePicker`, `Tag`, `Stepper`, `Table`, etc.) para controles de formulario y elementos interactivos en vez de etiquetas HTML nativas planas.
- **Tokens y Paleta Dinámica**: Los colores de acento se gestionan a través de `ThemeService` mediante `updatePrimaryPalette` de `@primeuix/themes`. Tailwind CSS v4 se encuentra vinculado mediante `tailwindcss-primeui` en `styles.css`.
- **Modo Oscuro**: Compatibilidad nativa con selector `.dark` y esquema de color sincronizado.
- **Tipografía y Forma**: Uso de `Inter` para cuerpo, `Plus Jakarta Sans` para titulares y `JetBrains Mono` para números, horas y contadores.
- **Modales y Diálogos Limpios (Cero Descripciones Innecesarias)**: Queda estrictamente prohibido abusar de párrafos descriptivos, subtítulos explicativos o textos secundarios en los encabezados (`#header`) o cuerpos de las ventanas modales (`p-dialog`) a menos que el usuario lo solicite explícitamente. Las modales deben ser directas, limpias y minimalistas: el encabezado contendrá únicamente el icono (si aplica) y el título directo de la acción. No explicar lo obvio ni saturar verticalmente los diálogos.
- **Cero Descripciones en Steps, Secciones y Módulos**: Queda estrictamente prohibido colocar descripciones, subtítulos explicativos o párrafos secundarios bajo los encabezados o títulos de steps (asistentes, onboarding, steppers, pestañas de configuración), módulos, tarjetas o secciones a menos que el usuario lo indique explícitamente. Los encabezados deben contener únicamente el título directo y su icono.
- **Prohibido el Abuso de Badges y Envoltorios de Iconos**: Queda prohibido el abuso de badges y envoltorios decorativos tipo caja/contenedor alrededor de los iconos (e.g. `w-8 h-8 rounded-xl bg-primary-100...`). Los iconos deben ubicarse de forma directa y limpia junto al texto sin cajas de fondo coloreadas innecesarias. Tampoco abusar de badges de texto o puntos pulsantes en la interfaz.
- **Iconografía Obligatoria para Actualizaciones**: Para cualquier funcionalidad, botón, diálogo, pestaña o sección de actualizaciones de la aplicación se debe utilizar **única y exclusivamente el icono de descargar (`tablerDownload`)**. Queda prohibido usar destellos (`tablerSparkles`), estrellas o iconos ambiguos.

---

## 6. Documentación Obligatoria por Módulos

Para garantizar la mantenibilidad y claridad del proyecto:
- Cada módulo de negocio existente o nuevo dentro de `src/app/modules/<module>/` **DEBE contar con un archivo de documentación en formato Markdown** ubicado en `docs/modules/<module>.md`.
- Dicho archivo debe detallar:
  1. Propósito y responsabilidad del módulo.
  2. Estructura de archivos y subdirectorios (páginas, componentes, servicios, interfaces).
  3. Flujo de usuario y componentes clave.
  4. Estado reactivo (Signals) y servicios integrados.
- Al crear, modificar o refactorizar un módulo, es obligatorio mantener actualizada su documentación correspondiente en `docs/modules/<module>.md`.

---

## 7. Resumen de Reglas Clave

| Aspecto | Regla Obligatoria |
|---|---|
| **Package Manager** | Siempre **Bun** (`bun`, `bun run`, `bun add`, `bunx`). Prohibido `npm`, `yarn`, `pnpm`. |
| **Idioma** | Siempre en **Inglés** (código, nombres, comentarios). Español solo en `shared/lang/es/`. |
| **Pluralidad** | Siempre en **Singular** (archivos, entidades, clases, carpetas de módulos). |
| **Skills** | Obligatorio consultar `angular-developer` y `angular-best-practices-primeng`. |
| **Angular** | Standalone components, `inject()`, Signals (`signal`, `computed`, `effect`), `@if` / `@for`, `input()` / `output()`. |
| **PrimeNG** | Imports tree-shaken por componente, tema Aura de `@primeuix/themes`. Prohibido Material / Spartan. |
| **Dashboard Layout** | Contenedor exclusivo de la barra lateral (sidebar) y menú superior. Todo contenido debe ser un componente separado cargado vía `<router-outlet />`. Prohibido contenido directo en `dashboard.page.html`. |
| **Diseño UI** | Consultar y seguir [`docs/DESIGN_RULES.md`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/docs/DESIGN_RULES.md). Priorizar siempre componentes oficiales de PrimeNG. |
| **Modales y Diálogos** | Prohibido incluir subtítulos o descripciones innecesarias en encabezados/cuerpos salvo petición explícita. Encabezado directo con solo icono y título. |
| **Descripciones en Steps/Módulos** | Prohibido colocar párrafos o textos descriptivos bajo los títulos en steps, secciones o módulos sin petición explícita. |
| **Uso de Badges e Iconos** | Prohibido abusar de badges y envoltorios contenedores de fondo (`bg-primary-100`) para iconos. Iconos limpios y directos. |
| **Icono de Actualizaciones** | Obligatorio usar el icono de descargar (`tablerDownload`). Prohibido destellos/estrellas. |
| **Documentación** | Todo módulo en `src/app/modules/<module>/` debe tener su `.md` en `docs/modules/<module>.md`. |
| **Verificación** | Ejecutar `bun run build` tras cualquier generación o refactorización. |
