# Módulo: Setup (Configuración Inicial)

El módulo `setup` gestiona el flujo del asistente (wizard) de bienvenida y configuración de **PocketProject**, guiando al usuario paso a paso antes de entrar al espacio de trabajo principal.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/setup/`
- **Ruta de Navegación**: `/setup` (definida en `setup.routes.ts`)

```
src/app/modules/setup/
├── components/
│   ├── appearance-step/      # Paso 1: Apariencia, Tema y Color de Acento
│   ├── schedule-step/        # Paso 2: Configuración de Jornada y Horario
│   ├── lunch-step/           # Paso 3: Tiempo de Almuerzo / Descanso
│   ├── openproject-step/     # Paso 4: Conexión con la API de OpenProject
│   ├── settings-panel/       # Panel de configuración compartido (modo edición del setup y /dashboard/settings)
│   ├── mcp-section/          # Integración MCP (usa `McpService`); el prompt viene de `get_mcp_contract`
│   └── mcp-status/           # Panel de compatibilidad MCP (también en Configuración → Sistema)
├── interfaces/
│   ├── mcp.interface.ts      # Contrato y estado de compatibilidad MCP
│   └── setup.interface.ts    # Modelos y contratos de UI del wizard
├── services/
│   ├── setup.service.ts      # Estado centralizado del wizard (Signals)
│   └── mcp.service.ts        # MCP: base local, estadísticas IA, instalación en clientes, reglas IA, contrato y estado de compatibilidad
├── pages/
│   └── setup/setup.page.{ts,html,css}  # Smart component controlador del flujo
└── setup.routes.ts           # Configuración de rutas lazy-loaded
```

---

## 2. Flujo y Pasos del Asistente

El asistente utiliza un componente `<p-stepper>` de PrimeNG y un switcher de contenido reactivo basado en el signal `setupService.activeStep()`:

```
[1. Apariencia] ──> [2. Horario] ──> [3. Almuerzo] ──> [4. OpenProject] ──> [Finalizar]
```

### Paso 1: Apariencia e Idioma (`AppearanceStepComponent`)
- **Modo de Color**: Selector de tema mediante botones para *Sistema*, *Claro* y *Oscuro*, aplicando inmediatamente la clase `.dark` o `.light` en el elemento raíz del DOM.
- **Selector de Idioma**: Componente PrimeNG `<p-select>` que permite alternar entre Español e Inglés en caliente con previsualización de banderas y nombres nativos.
- **Color de Acento**: Componente PrimeNG `<p-select>` para seleccionar el color primario de la aplicación (`violet`, `indigo`, `blue`, `emerald`, `amber`, `rose`), actualizando en tiempo real la paleta semántica del tema Aura.

### Paso 2: Horario Laboral (`ScheduleStepComponent`)
- Reutiliza el componente transversal `<app-schedule-editor>` (compartido de forma unificada con la modal de edición en `overview` y la sección de usuario en `setting`).
- **Modos de Jornada**: Soporta configuración agrupada (*Por Grupos*) o individual (*Día por Día*).
- **Selector de Días**: Permite asignar días hábiles de la semana a cada horario.
- **Horas de Entrada y Salida**: Utiliza `<p-datepicker>` de PrimeNG configurado en modo horario (`[timeOnly]="true"` y formato de 12 horas con intervalos de 5 minutos).
- **Mínimo de Horas a Registrar Diarias**: Campo numérico `<p-inputnumber>` con botones de incremento/decremento (`+` / `-` 0.5h), preajustes rápidos (7.5h, 8.0h, 8.5h, 9.0h) y cálculo en tiempo real de minutos equivalentes (persistido como `min_daily_minutes` en SQLite).
- **Resumen en Tiempo Real**: Calcula el total de minutos laborables semanales y valida que exista al menos un horario válido configurado.

### Paso 3: Descanso / Almuerzo (`LunchStepComponent`)
- **Campo Numérico con Acento**: Utiliza el componente PrimeNG `<p-inputnumber>` con sufijo `" min"` y estilo tipográfico que adopta el color de acento activo (`text-primary-600 dark:text-primary-400`).
- **Controles de Ajuste Rápido**: Botones laterales de incremento y decremento (`button` con directiva `pButton` e iconos Tabler `+` y `-`).
- **Preajustes**: Botones de selección directa para 0 min (sin descanso), 30 min, 45 min, 60 min (1h) y 90 min.

### Paso 4: Conexión OpenProject (`OpenprojectStepComponent`)
- **URL y Token**: Inputs para ingresar la URL base del servidor OpenProject y el Personal Access Token (PAT).
- **Guía de Obtención de Token**: Disparador "¿Cómo obtener tu token?" que abre el diálogo modal dedicado `app-token-guide-modal` con 5 pasos ilustrados y completamente autocontenido (sin enlaces externos).
- **Prueba de Conexión en Vivo**: Ejecuta llamada a la API a través de `HttpService` / `StorageService` para comprobar la validez del token y reporta el usuario autenticado con un `<p-tag>` de estado.

---

## 3. Navegación y Footer Centralizado

La navegación del asistente está centralizada en el componente contenedor [`setup.page.html`](file:///C:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/modules/setup/pages/setup/setup.page.html):
- **Botón Atrás**: Se renderiza automáticamente a partir del paso 2 (`activeStep > 1`) y navega al paso anterior (`prevStep()`).
- **Botón Siguiente**: Avanza al siguiente paso (`nextStep()`) en los pasos 1 a 3. Se desactiva reactivamente mediante `isNextDisabled` si el paso actual no cumple sus requisitos de validación (por ejemplo, si no hay grupos de horario configurados en el paso 2).
- **Botón Guardar y Empezar**: En el paso 4, el botón se transforma en el disparador de finalización (`completeSetup()`) con indicador de carga (`loading`).

---

## 4. Persistencia, Validación y Control de Acceso

El asistente solo se muestra cuando es la primera vez que se ejecuta la aplicación o cuando no existe configuración guardada en el sistema:

1. **Tabla en Base de Datos SQLite (`app_config`)**:
   - Posee la columna `is_configured INTEGER NOT NULL DEFAULT 0` que rastrea si la configuración inicial ya ha sido completada.
   - En Tauri se invoca el comando Rust `check_is_configured` y `get_app_config` para leer de la base de datos `pocketproject.sqlite`.
2. **Inicialización Asíncrona con `provideAppInitializer`**:
   - `StorageService.loadConfig()` se ejecuta durante el arranque de Angular mediante `provideAppInitializer()`, bloqueando la navegación inicial hasta haber recuperado de forma fidedigna el estado persistido en SQLite (o caché de fallback).
3. **Control por Guards**:
   - `configGuard`: Si `is_configured` es `false`, redirige automáticamente hacia `/setup`. Si es `true`, permite el acceso al `/dashboard`.
   - `setupGuard`: Si `is_configured` es `true` y no se incluye el parámetro de consulta `?edit=true`, bloquea el acceso a `/setup` y redirige a `/dashboard`. Permite acceder únicamente si el programa aún no está configurado o si el usuario pulsa deliberadamente "Configuración" desde el dashboard (`/setup?edit=true`).
4. **Diseño a Pantalla Completa y Ventana Maximizada**:
   - **Modo Pantalla Completa en Onboarding Inicial**: Para permitir completar los formularios de horario, almuerzo y OpenProject de manera cómoda y sin restricciones de espacio, la aplicación maximiza automáticamente la ventana nativa de Tauri al iniciar el setup inicial (`!is_configured`).
   - **Contenedor Principal de Ancho Completo**: Ocupa el 100% de la ventana (`h-dvh w-full overflow-hidden`) con el encabezado y el stepper fijados en la parte superior, el contenido central centrado en un ancho ergonómico (`max-w-4xl mx-auto w-full`) con scroll vertical independiente, y el pie de navegación inferior fijo.
   - **Barra de Acciones Superior Unificada (`<app-header>`)**: Componente transversal reutilizable con arrastre suave de ventana (`startDragging`), doble clic para maximizar/restaurar, y controles nativos de Windows (Minimizar, Maximizar / Restaurar y Cerrar con modal de confirmación en setup inicial).
   - **Retorno a Modo Compacto**: al terminar el onboarding (`completeSetup()` → `setCompactMode({ reset: true })`) la ventana se desmaximiza y vuelve al tamaño compacto por defecto (525x800) centrada. Al guardar o cerrar los ajustes de la ventana compacta (`/setup?edit=true`) solo se navega a `/compact` (`returnToCompact()`): la ventana conserva su tamaño, posición y maximizado.
