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

## 4. Estructura, Organización y Arquitectura

El proyecto tiene dos capas de código, cada una con su propia arquitectura:

| Capa | Ubicación | Arquitectura | Documento de referencia |
|---|---|---|---|
| Frontend (Angular) | `src/app/` | `core/` + `modules/` + `shared/` | [`docs/frontend.md`](../docs/frontend.md) |
| Backend (Tauri / Rust) | `src-tauri/src/` | Capas `command` → `service` → `openproject` / `repository`, con `model` | [`docs/backend.md`](../docs/backend.md) |

### 4.1. Árbol del Frontend

```
src/app/
├── app.component.ts, app.config.ts, app.routes.ts
├── core/                         # Singletons e infraestructura (nunca importa de modules/)
│   ├── guards/                   # Guards funcionales (CanActivateFn): config.guard.ts
│   ├── interfaces/               # Contratos globales: activity, config, openproject
│   ├── services/
│   │   ├── openproject/          # Capa de API de OpenProject, un servicio por dominio
│   │   │   ├── openproject.service.ts           # Cliente base: URL, token, cabeceras, runtime, conversores
│   │   │   ├── work-package-api.service.ts      # Ticket info/contexto, búsqueda, revisiones, estado/versión
│   │   │   ├── work-package-form-api.service.ts # Esquema del formulario, actualización de campos, comentarios
│   │   │   ├── attachment-api.service.ts        # Adjuntos: descarga, contenido, imágenes inline, subida
│   │   │   ├── project-api.service.ts           # Proyectos, estados, versiones (con caché)
│   │   │   ├── board-api.service.ts             # Tableros, columnas, mover tickets (con caché)
│   │   │   └── time-entry-api.service.ts        # Tipos de actividad, tiempos, reporte de costos
│   │   ├── activity.service.ts   # Actividades locales (SQLite), navegación de día, sincronización, estado de modales
│   │   ├── favorite.service.ts   # Tickets favoritos
│   │   ├── notification.service.ts, breadcrumb.service.ts
│   │   └── storage, theme, language, schedule, update, window, work-package-change
│   └── utils/                    # Funciones puras y constantes (*.util.ts)
├── modules/<module>/             # Un módulo por dominio o vista enrutada (singular)
│   ├── components/               # Componentes del módulo (o que el módulo posee y otros importan)
│   ├── modals/                   # Diálogos del módulo
│   ├── pages/                    # Páginas enrutadas (smart components)
│   ├── services/                 # Servicios exclusivos del módulo
│   ├── interfaces/               # Tipos exclusivos del módulo
│   └── <module>.router.ts        # Rutas con carga diferida
└── shared/                       # Reutilizable sin estado de negocio propio
    ├── components/               # app-header, app-logo, close-confirm-modal, rich-text-editor, schedule-editor, ...
    ├── pipes/                    # translate.pipe.ts
    ├── format/                   # Formateadores puros (time.ts)
    └── lang/                     # es/, en/ y primeng-locale.ts
```

Módulos actuales: `board` (tableros, listado de tableros y detalle de ticket), `compact` (ventana compacta), `dashboard` (shell), `overview`, `project`, `report`, `setting`, `setup` y `time-entry` (registro de tiempo).

### 4.2. Reglas de Ubicación de Archivos (Frontend)

| Qué | Dónde |
|---|---|
| Servicio singleton, interfaz global, guard o utilidad pura | `core/` |
| Componente usado por un solo módulo | `modules/<module>/components/` (o `modals/` si es un diálogo) |
| Componente de negocio usado por varios módulos | En el módulo dueño de ese dominio; los demás lo importan desde allí (no se duplica ni se sube a `shared/`) |
| Componente sin estado de negocio usado por varios módulos | `shared/components/` |
| Servicio usado por un solo módulo | `modules/<module>/services/` (p. ej. `setup/services/mcp.service.ts`) |
| Plantilla de más de ~80 líneas | Archivo hermano `.component.html` (y `.css` para estilos); no usar `template` inline |

- **Dueños actuales de componentes compartidos**: `modules/time-entry/components/activity-row` y `modules/time-entry/modals/*` (los usan `compact`, `time-entry` y el detalle de ticket de `board`); `modules/board/pages/ticket-detail.page` (también embebido en el drawer de `time-entry`); `shared/components/close-confirm-modal` (compact, dashboard y setup).
- **Prohibido duplicar componentes** entre módulos: si dos módulos necesitan el mismo componente, se mueve al dueño del dominio o a `shared/`.
- **Prohibido reexportar** componentes desde otra carpeta para "aparentar" que pertenecen a un módulo; se importan desde su ubicación real.
- **`core/` no depende de `modules/`**; `shared/` no depende de `modules/`.

### 4.3. Capa de API de OpenProject (Frontend)

- Prohibido volver a crear un servicio monolítico de OpenProject. Cada llamada nueva va al servicio de su dominio en `core/services/openproject/`; si no encaja en ninguno, se crea un nuevo `<domain>-api.service.ts`.
- Todos los servicios de dominio dependen de `OpenprojectService` (cliente base) para URL, token, cabeceras (`buildAuthHeaders`), detección de Tauri (`isTauriApp`) y `resolveHref`.
- Dirección de dependencias permitida: `WorkPackageApiService` → `ProjectApiService`; `BoardApiService` → `WorkPackageApiService`. Prohibido añadir la dirección inversa (dependencia circular de DI).
- Los componentes inyectan solo los servicios que usan, con nombres cortos: `workPackageApi`, `workPackageFormApi`, `attachmentApi`, `projectApi`, `boardApi`, `timeEntryApi`, `openprojectService`.
- En escritorio cada método llama a un comando Tauri (`invoke`); en web usa `fetch` contra `/api/v3`. Ambos caminos deben devolver la misma forma de datos.

### 4.4. Arquitectura del Dashboard como Contenedor Principal (Shell / Layout)
- **Rol Exclusivo de Contenedor**: El componente `DashboardPage` (`src/app/modules/dashboard/pages/dashboard.page.ts`) actúa **única y exclusivamente como contenedor principal y layout estructural** de la aplicación.
- **Elementos que Habitan en el Dashboard**:
  1. **Barra Lateral (`p-sidebar`)**: Navegación agrupada (secciones PocketProject y OpenProject), buscador de la barra lateral, proyectos y perfil de usuario con avatar en el footer.
  2. **Barra Superior (`<header>`)**: Toggle del sidebar (`pSidebarTrigger`), breadcrumb (`Proyectos > proyecto > Tableros > tablero > #ticket`), refresco, tema claro/oscuro y acceso a configuración.
  3. **Área de Proyección de Contenido (`<main>`)**: Contenedor que aloja el `<router-outlet />` donde se renderizan las vistas hijas.
  4. **Notificaciones**: `<p-toast>` global para `NotificationService`.
- **Separación Obligatoria del Contenido en Componentes Separados**:
  - **Queda estrictamente prohibido incrustar contenido de negocio, tarjetas, calendarios o paneles directamente en `dashboard.page.html`**.
  - **Cada contenido es un componente separado e independiente** en su propio módulo (`overview`, `project`, `board`, `time-entry`, `report`, `setting`).
  - **Enrutamiento por Vistas Hijas**: `dashboard.router.ts` define las rutas secundarias mediante `children`, cargando cada contenido con `loadChildren` o `loadComponent`.
  - **La lógica de dominio no vive en el shell**: búsquedas o resoluciones de datos (p. ej. qué tablero contiene un ticket) van al servicio de API correspondiente (`BoardApiService.findBoardContainingTicket`), no a `DashboardPage`.
  - **Autonomía y Modularidad**: Cada componente de contenido administra sus propios Signals, inyección de dependencias (`inject()`), estados de carga (`p-skeleton`), acciones y subcomponentes.

### 4.5. Arquitectura del Backend (Tauri / Rust)

```
src-tauri/src/
├── main.rs            # Punto de entrada: pocketproject_lib::run()
├── lib.rs             # Solo declaraciones `mod` y run(): plugins, setup, generate_handler!
├── ipc.rs             # Servidor HTTP local para el MCP de PocketProject (/ping, /notify, /show)
├── app/               # Arranque: setup.rs, tray.rs (bandeja), window.rs (eventos de ventana)
├── command/           # #[tauri::command] delgados, un archivo por dominio
├── service/           # Lógica de negocio por dominio (OpenProject, MCP, reportes, tableros...)
├── openproject/       # Infraestructura HTTP: cliente, auth, URLs, parseo de esquemas y respuestas
├── repository/        # SQLite por tabla: connection, migration, activity, config, favorite_ticket, statistic
└── model/             # DTOs y registros (structs serde) por dominio
```

- **Dirección de capas**: `command` → `service` → `openproject` / `repository`; todas las capas usan `model`. Una capa nunca importa de una capa superior.
- **Comandos delgados**: un comando solo recibe argumentos y delega en `service::` (o en `repository::` para operaciones locales simples de SQLite). Prohibido poner lógica, peticiones HTTP o SQL en `command/`.
- **Contrato IPC estable**: los nombres de comandos, nombres de argumentos, campos serde (`rename_all`), formas de respuesta y textos de error son un contrato con el frontend y con el servidor MCP. No se cambian sin actualizar ambos lados.
- **Frontera de errores**: los comandos devuelven `Result<T, String>`.
- **Visibilidad**: `pub(crate)` por defecto; nada de reexportaciones globales (`pub use *`) que oculten dónde vive el código.
- **Nombres**: archivos y módulos en inglés, singular y `snake_case` (`favorite_ticket.rs`, `board_move.rs`).
- **Tamaño**: archivos por debajo de ~400 líneas; si una función crece demasiado, se extraen helpers en `service/` u `openproject/`.
- **Nuevo comando** (pasos): 1) DTO en `model/<domain>.rs`; 2) lógica en `service/<domain>.rs` (HTTP vía `openproject/`, SQL vía `repository/`); 3) wrapper en `command/<domain>.rs`; 4) registrarlo en `generate_handler!` de `lib.rs`; 5) método en el servicio de API del frontend que corresponda.
- **Verificación**: tras cambios en Rust ejecutar `cargo check` en `src-tauri/`.

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
| **Estructura Frontend** | `core/` (singletons, API de OpenProject por dominio en `core/services/openproject/`), `modules/<module>/` (components, modals, pages, services), `shared/` (sin estado de negocio). Componente compartido de negocio = en el módulo dueño. Sin duplicados ni reexportaciones. |
| **Arquitectura Backend** | Rust por capas: `command` (delgado) → `service` → `openproject` / `repository`, con `model`. Contrato IPC estable. Ver `docs/backend.md`. |
| **Dashboard Layout** | Contenedor exclusivo de la barra lateral (sidebar) y menú superior. Todo contenido debe ser un componente separado cargado vía `<router-outlet />`. Prohibido contenido directo en `dashboard.page.html`. |
| **Diseño UI** | Consultar y seguir [`docs/DESIGN_RULES.md`](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/docs/DESIGN_RULES.md). Priorizar siempre componentes oficiales de PrimeNG. |
| **Modales y Diálogos** | Prohibido incluir subtítulos o descripciones innecesarias en encabezados/cuerpos salvo petición explícita. Encabezado directo con solo icono y título. |
| **Descripciones en Steps/Módulos** | Prohibido colocar párrafos o textos descriptivos bajo los títulos en steps, secciones o módulos sin petición explícita. |
| **Uso de Badges e Iconos** | Prohibido abusar de badges y envoltorios contenedores de fondo (`bg-primary-100`) para iconos. Iconos limpios y directos. |
| **Icono de Actualizaciones** | Obligatorio usar el icono de descargar (`tablerDownload`). Prohibido destellos/estrellas. |
| **Documentación** | Todo módulo en `src/app/modules/<module>/` debe tener su `.md` en `docs/modules/<module>.md`; la arquitectura general vive en `docs/frontend.md` y `docs/backend.md`. |
| **Verificación** | Ejecutar `bun run build` tras cualquier generación o refactorización, y `cargo check` tras cambios en Rust. |

---

## 8. Directrices Obligatorias de PocketProject Time Tracker (MCP)

Todo agente o asistente que opere con el servidor MCP de PocketProject debe cumplir estrictamente:
- **Interpretación de Modismos**:
  - "Necesito llenar el ticket 11111", "cargar horas a 11111", "imputar tiempo en 11111" -> registrar actividad (`add_activity`).
  - "Empezar con el ticket 11111" -> iniciar cronómetro (`start_timer`).
  - "Resumen de hoy" o "¿Cómo voy hoy?" -> `get_today_summary`.
  - "¿Quién soy?", "Datos de mi usuario" -> `get_user_info`.
  - "Listar proyectos", "Ver proyectos" -> `get_projects`.
  - "Listar estados", "¿Cuáles son los estados de OpenProject?" -> `get_statuses`.
  - "Cambiar estado del ticket 11111 a [estado]" -> `update_ticket_status`.
  - "Ver tableros del proyecto", "Columnas del tablero" -> `get_project_boards` / `get_board_columns`.
  - "Mover ticket 11111 a la columna [columna]" -> `move_ticket_column`.
- **Prohibido Inventar Tickets**: Jamás inventar o asumir un número de ticket que el usuario no haya escrito textualmente. Si no hay ticket, el campo debe ser omitido o `null`.
- **Protocolo de Validación en Cascada**:
  1. Ejecutar primero `get_ticket_context(ticket: "11111")` (resolución local ➔ OpenProject API en vivo).
  2. Si `found: true`: usar título oficial (`subject`) y proyecto.
  3. Si `found: false`: preguntar al usuario si el PM o encargado ya creó el ticket en el sistema. Si aún no está creado, registrarlo localmente con `ticket: null` indicando que queda pendiente de ticket.
- **Lectura Progresiva de Contexto y Banderas del Ticket**:
  - `get_ticket_context` incluye por defecto la descripción del ticket (`include_description: true`). El agente debe leer la descripción para comprender el requerimiento.
  - **Sugerir lectura de comentarios**: Tras leer la descripción, el agente debe sugerir de forma proactiva al usuario si desea que consulte los comentarios o notas: *"He leído la descripción del ticket. ¿Deseas que revise los comentarios para obtener más detalles?"*. Solo si el usuario lo pide o autoriza, se ejecuta con `include_comments: true`.
  - **Permisos Obligatorios para Archivos y Adjuntos**: NUNCA descargar ni leer un archivo adjunto o imagen sin pedir confirmación explícita al usuario: *"El ticket contiene el archivo adjunto [nombre]. ¿Me autorizas a descargarlo y revisar su contenido?"*. Solo con autorización se ejecuta `get_ticket_attachment`.
- **Gestión de Estados, Tableros y Ciclo de Vida del Ticket**:
  - **Roles**: El PM crea o se le solicita el ticket; el responsable supervisa la tarea y el asignado es quien solventa y desarrolla.
  - **Inicio y Borrador para el PM**: Al empezar una tarea, si no hay ticket, pedir el número al usuario o indicar que lo solicite al PM. Si se le va a pedir al PM, el agente debe ofrecer generarle el borrador en texto con el formato estructurado (`Nombre de ticket`, `Descripción`, `Tiempo`, `Fecha Inicio y Fin`).
  - **Comprobación de Columnas Reales**: El agente DEBE SIEMPRE verificar las columnas reales extraídas de OpenProject (`get_board_columns`) antes de intentar mover un ticket, sin asumir nombres fijos sin contrastar.
  - **En Curso**: Durante el desarrollo, asignar estado **"En desarrollo"** y mover a columna real correspondiente ("HACER HOY" o "EN CURSO", consultando al usuario cuál prefiere).
  - **Sin Solución / Comportamiento Esperado**: Si no tiene solución técnica o es el comportamiento esperado, estado **"Justificado"**.
  - **Bloqueo por Dependencia**: Si depende de otra tarea externa para continuar, estado **"En espera"** y mover a columna **"BLOQUEANTE"**.
  - **Desarrollo Culminado**: Al terminar, pasar a estado **"Desarrollado"** y a columna **"DESARROLLADO"**.
  - **Prueba Fallida**: Si el ticket está en **"Prueba fallida"**, la solución previa no funcionó. Investigar leyendo la descripción, sugiriendo revisar comentarios y pidiendo permiso para revisar archivos.
  - **Pase a Producción y Cierre**: Tras desplegarse, superar QA y estar en producción sin inconvenientes, el PM o el asignado delegado pasan a estado **"Cerrado"** y columna **"FINALIZADO"**.
  - **Confirmación Obligatoria**: Cualquier cambio en OpenProject es inmediato. Ante cualquier duda o transición, **PREGUNTAR SIEMPRE AL USUARIO** a qué columna o estado mover, mostrando las opciones disponibles. Jamás ejecutar transiciones a ciegas.
  - **Confirmación Obligatoria para Asignado (Assignee)**: Antes de asignar o modificar el campo **Asignado** (`assignee`) de cualquier ticket vía MCP, el agente **DEBE SIEMPRE preguntar al usuario** a quién asignar (mostrando las opciones disponibles si las conoce). Jamás asignar un ticket sin confirmación explícita del usuario.
  - **Diferenciación Local vs. Plataforma**: Al consultar o reportar tiempos de un ticket, distinguir explícitamente entre los registros locales de PocketProject (pendientes o sincronizados en SQLite) y los tiempos reales registrados directamente en la plataforma OpenProject.
