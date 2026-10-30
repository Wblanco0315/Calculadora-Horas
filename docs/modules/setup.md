# Módulo: Setup (Configuración Inicial)

El módulo `setup` gestiona el flujo del asistente (wizard) de bienvenida y configuración de **PocketProject**, guiando al usuario paso a paso antes de entrar al espacio de trabajo principal.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/setup/`
- **Ruta de Navegación**: `/setup` (definida en `setup.router.ts`)

```
src/app/modules/setup/
├── components/
│   ├── appearance-step/      # Paso 1: Apariencia, Tema y Color de Acento
│   ├── schedule-step/        # Paso 2: Configuración de Jornada y Horario
│   ├── lunch-step/           # Paso 3: Tiempo de Almuerzo / Descanso
│   ├── openproject-step/     # Paso 4: Conexión con la API de OpenProject
│   └── setup-header/         # Encabezado unificado del asistente
├── interfaces/
│   └── setup.interface.ts    # Modelos y contratos de UI del wizard
├── pages/
│   ├── setup.page.html       # Estructura del Stepper y navegación compartida
│   ├── setup.page.ts         # Smart component controlador del flujo
│   └── setup.page.css        # Estilos específicos de la página
├── services/
│   └── setup.service.ts      # Estado centralizado del wizard (Signals)
└── setup.router.ts           # Configuración de rutas lazy-loaded
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
- Reutiliza el componente transversal `<app-schedule-editor>` (compartido de forma unificada con la modal de edición en `overview`).
- **Modos de Jornada**: Soporta configuración agrupada (*Por Grupos*) o individual (*Día por Día*).
- **Selector de Días**: Permite asignar días hábiles de la semana a cada horario.
- **Horas de Entrada y Salida**: Utiliza `<p-datepicker>` de PrimeNG configurado en modo horario (`[timeOnly]="true"` y formato de 12 horas con intervalos de 5 minutos).
- **Resumen en Tiempo Real**: Calcula el total de minutos laborables semanales y valida que exista al menos un horario válido configurado.

### Paso 3: Descanso / Almuerzo (`LunchStepComponent`)
- **Campo Numérico con Acento**: Utiliza el componente PrimeNG `<p-inputnumber>` con sufijo `" min"` y estilo tipográfico que adopta el color de acento activo (`text-primary-600 dark:text-primary-400`).
- **Controles de Ajuste Rápido**: Botones laterales de incremento y decremento (`button` con directiva `pButton` e iconos Tabler `+` y `-`).
- **Preajustes**: Botones de selección directa para 0 min (sin descanso), 30 min, 45 min, 60 min (1h) y 90 min.

### Paso 4: Conexión OpenProject (`OpenprojectStepComponent`)
- **URL y Token**: Inputs para ingresar la URL base del servidor OpenProject y el Personal Access Token (PAT).
- **Prueba de Conexión en Vivo**: Ejecuta llamada a la API a través de `HttpService` / `StorageService` para comprobar la validez del token y reporta el usuario autenticado con un `<p-tag>` de estado.

---

## 3. Navegación y Footer Centralizado

La navegación del asistente está centralizada en el componente contenedor [`setup.page.html`](file:///C:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/modules/setup/pages/setup.page.html):
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
4. **Diseño Responsivo Adaptable**:
   - **Contenedor Principal**: Modal estructurado con encabezado y barra de pasos superiores fijos (`shrink-0`), área de contenido con scroll vertical interno suave (`overflow-y-auto overscroll-contain`) y pie de navegación inferior fijo (`shrink-0`).
   - **Stepper Adaptativo**: En pantallas móviles o ventanas pequeñas (`< 640px`), los títulos de paso se ocultan dejando los círculos numerados compactos, mientras que el encabezado muestra el indicador de avance (e.g. `2/4`).
   - **Controles de Horario y Tarjetas**: En pantallas pequeñas, los selectores de día y las tarjetas de reglas configuradas se apilan limpiamente en dos filas (nombre arriba, horario y acciones abajo) sin desbordamientos horizontales.
   - **Selector de Temas y Almuerzo**: Botones y campos numéricos con proporciones escalables aptos para ventanas desde 320px de ancho y alturas reducidas (600px en ventana nativa Tauri).
