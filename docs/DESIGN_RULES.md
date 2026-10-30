# PocketProject Design System & UI Rules

Este documento define los estándares de diseño visual, sistema temático, integración con PrimeNG, tokens de Tailwind CSS v4 y directrices de interfaz de usuario para **PocketProject**.

---

## 1. Filosofía de Diseño

PocketProject es una aplicación de escritorio moderna, minimalista y de alta productividad construida sobre Angular 22, PrimeNG, Tailwind CSS y Tauri. La interfaz debe transmitir elegancia, claridad, rapidez y consistencia en cada componente.

Principios rectores:
1. **Claridad Visual**: Contraste adecuado, tipografías nítidas y jerarquía visual evidente.
2. **Reactividad Temática Total**: Cualquier cambio de modo (Claro / Oscuro / Sistema) o de color de acento se propaga instantáneamente a todos los componentes de la aplicación.
3. **Consistencia de Componentes**: No reinventar la rueda; utilizar los componentes de diseño de PrimeNG en lugar de maquetaciones HTML crudas.

---

## 2. Prioridad Mandatoria de Componentes PrimeNG

Siguiendo la regla de oro del proyecto:
- **Siempre priorizar PrimeNG**: Si existe un componente oficial de PrimeNG que resuelva la necesidad (e.g., `p-select`, `p-inputnumber`, `p-datepicker`, `p-stepper`, `p-table`, `p-tag`, `p-dialog`, `p-tabs`, `p-menu`), **se debe usar dicho componente**.
- **Prohibido maquetar inputs nativos planos** cuando exista un componente PrimeNG equivalente (por ejemplo, usar `<p-inputnumber>` en lugar de `<input type="number">`).
- **Tree-Shaking Obligatorio**: Importar de forma granular el componente o directiva standalone directamente desde su submódulo (ejemplo: `import { InputNumber } from 'primeng/inputnumber';`, `import { Select } from 'primeng/select';`, `import { ButtonDirective } from 'primeng/button';`).

---

## 2.1. Estándar Obligatorio para Botones: `ButtonDirective` (`<button pButton>`)

> [!IMPORTANT]
> **PROHIBIDO EL USO DEL COMPONENTE `<p-button>`**: El componente `<p-button>` y eventos propietarios como `(onClick)` están deprecados en favor de la directiva nativa `pButton`. Todos los botones de la aplicación **DEBEN** crearse utilizando la etiqueta nativa `<button>` con la directiva `pButton`.

### Reglas de Implementación de Botones:
1. **Importación**: Importar exclusivamente `ButtonDirective` desde `primeng/button`:
   ```typescript
   import { ButtonDirective } from 'primeng/button';
   ```
2. **Estructura HTML**: Usar siempre `<button pButton>`:
   ```html
   <button pButton ...>
     ...
   </button>
   ```
3. **Eventos**: Utilizar el evento estándar nativo de Angular `(click)` (nunca el deprecado `(onClick)`):
   ```html
   <button pButton (click)="miFuncion()">...</button>
   ```
4. **Propiedades y Modificadores de `ButtonDirective`**:
   - **Severidad (`severity`)**: `'primary'`, `'secondary'`, `'success'`, `'info'`, `'warn'`, `'danger'`, `'contrast'`.
   - **Variantes (`variant`)**: `variant="outlined"` (para bordes con fondo transparente), `variant="text"` (para botones planos con texto).
     > [!WARNING]
     > **REGLA CRÍTICA PARA BOTONES `iconOnly`**:
     > **NUNCA** usar `variant="text"` en botones que tengan el atributo `iconOnly`. La clase de texto altera el padding y desfasa el centrado del icono dentro del contenedor del botón. En botones de solo icono, omitir `variant="text"` y dejar que PrimeNG aplique el centrado cuadrado/circular nativo de `iconOnly`.
   - **Forma y Relieve**:
     - `rounded` / `[rounded]="true"` para bordes circulares o cápsula.
     - `raised` / `[raised]="true"` para añadir sombra y relieve suave.
     - `iconOnly` / `[iconOnly]="true"` para botones cuadrados/circulares que solo contienen un icono (¡sin `variant="text"`!).
   - **Tamaño (`size`)**: `size="small"` o `size="large"`.
   - **Estados Reactivos**:
     - `[disabled]="condicion"`
     - `[loading]="isLoading()"` (muestra el spinner de carga automáticamente).

### Ejemplos Estándar del Proyecto:

```html
<!-- 1. Botón de Acción Principal con Icono y Texto -->
<button
  pButton
  (click)="guardar()"
  [disabled]="isSaving()"
  [loading]="isSaving()"
  size="small"
  class="h-10 px-4"
>
  <ng-icon name="tablerDeviceFloppy" class="mr-1.5" />
  <span>{{ 'common.save' | translate }}</span>
</button>

<!-- 2. Botón Secundario Delineado (Outlined) -->
<button
  pButton
  (click)="cancelar()"
  variant="outlined"
  severity="secondary"
  size="small"
>
  {{ 'common.cancel' | translate }}
</button>

<!-- 3. Botón de Icono Solo Circular (Icon-Only + Rounded) -->
<button
  pButton
  (click)="incrementar()"
  iconOnly
  rounded
  raised
  variant="outlined"
  severity="secondary"
  size="small"
  [title]="'common.increment' | translate"
>
  <ng-icon name="tablerPlus" />
</button>

<!-- 4. Botón de Acción Peligrosa / Eliminar Plano de Solo Icono (Sin variant="text") -->
<button
  pButton
  (click)="eliminar()"
  iconOnly
  rounded
  severity="danger"
  size="small"
  [title]="'common.delete' | translate"
>
  <ng-icon name="tablerTrash" />
</button>
```

---

## 2.2. Estándar Obligatorio para Campos de Contraseña: `InputPassword` (`pInputPassword`)

> [!IMPORTANT]
> **USO OBLIGATORIO DE `pInputPassword`**: En PrimeNG v22, el componente wrapper `<p-password>` y la directiva `pPassword` están deprecados. Se debe utilizar la directiva nativa `pInputPassword` en combinación con los componentes contenedores `IconField` (`<p-iconfield>`) e `InputIcon` (`<p-inputicon>`).

### Reglas de Implementación de Password:
1. **Tree-Shaking de Importaciones**:
   Importar las directivas y componentes standalone requeridos:
   ```typescript
   import { InputPassword } from 'primeng/inputpassword';
   import { IconField } from 'primeng/iconfield';
   import { InputIcon } from 'primeng/inputicon';
   ```
2. **Definición del Estado `mask` en el Componente**:
   Declarar la propiedad de enmascaramiento booleana en el componente:
   ```typescript
   export class MiComponente {
     mask = true;
   }
   ```
3. **Estructura HTML Estándar con `p-iconfield` y `p-inputicon`**:
   - El contenedor `<p-iconfield>` envuelve el `<input>` y el `<p-inputicon>`.
   - Vincular `[(mask)]="mask"` de forma bidireccional en el `<input pInputPassword>`.
   - El `<p-inputicon>` alterna el estado mediante `(click)="mask = !mask"`.
   - Controlar el icono mediante `@if (mask)`.

```html
<p-iconfield class="w-full block">
  <input
    id="token-field"
    pInputPassword
    [(mask)]="mask"
    [placeholder]="'auth.tokenPlaceholder' | translate"
    [ngModel]="tokenValue()"
    (ngModelChange)="onTokenChange($event)"
    class="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 pr-12 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-100 font-mono text-xs sm:text-sm transition-all"
  />
  <p-inputicon
    (click)="mask = !mask"
    style="cursor: pointer"
    [title]="(mask ? 'common.show' : 'common.hide') | translate"
  >
    @if (mask) {
      <ng-icon name="tablerEyeOff" size="1.1rem" />
    } @else {
      <ng-icon name="tablerEye" size="1.1rem" />
    }
  </p-inputicon>
</p-iconfield>
```

> [!WARNING]
> **REGLAS CRÍTICAS PARA `pInputPassword`**:
> 1. **NUNCA agregar `[type]="..."` al `<input>`**: La directiva `InputPassword` maneja automáticamente el atributo `attr.type` (`password` cuando `mask` es `true` y `text` cuando `mask` es `false`). Si se agrega manualmente un `[type]`, competirá con el host binding de la directiva y provocará comportamientos erráticos.
> 2. **Vincular siempre `[(mask)]="mask"`**: Sin esta directiva bidireccional, el input no reaccionará a los clics del icono de alternar visibilidad.
> 3. **No usar botones absolutos manuales**: No crear etiquetas `<button>` flotantes manuales; `<p-iconfield>` y `<p-inputicon>` proporcionan la integración semántica, estilizada y accesible de PrimeUI.

---

## 2.3. Estándar Obligatorio para Modales y Diálogos (`p-dialog`): Cero Descripciones Innecesarias

> [!IMPORTANT]
> **PROHIBIDO EL ABUSO DE DESCRIPCIONES O SUBTÍTULOS EN MODALES**:
> Salvo que el usuario lo pida expresamente, **las ventanas modales NO deben incluir subtítulos, párrafos descriptivos explicativos ni textos secundarios de relleno** en sus encabezados (`#header`) ni en su cuerpo principal.
> 
> - **Encabezado Minimalista y Limpio**: El `<ng-template #header>` debe contener exclusivamente el icono distintivo (si corresponde) y el título directo de la acción (`<h3>` o `<span>`). No añadir etiquetas `<p class="text-xs text-slate-500 ...">` explicando lo que hace el formulario o la pantalla.
> - **Enfoque en el Contenido y la Acción**: El usuario ya sabe qué acción está ejecutando al abrir la modal; la interfaz debe ir directo a los controles interactivos (inputs, selectores, confirmación) ahorrando espacio vertical y evitando ruido visual innecesario.
> - **Diálogos de Confirmación**: En diálogos de confirmación o alerta (e.g. eliminar, reiniciar), limitar el texto al mensaje puntual de la pregunta de confirmación, sin redundancias.

---

## 3. Sistema Temático y Tokens de Color

### 3.1. Preset Base PrimeUI (Aura)
La aplicación utiliza el tema **Aura** configurado mediante `@primeuix/themes/aura` y `definePreset` en `app.config.ts`:
- Selector de modo oscuro: `.dark`.
- Paleta semántica dinámica: La paleta primaria (`primary`) se actualiza en tiempo de ejecución mediante `updatePrimaryPalette(palette(hex))` en `ThemeService`.

### 3.2. Paleta de Colores de Acento y Selector Personalizado
La aplicación ofrece colores primarios predefinidos de alto contraste, complementados con la capacidad de seleccionar cualquier color personalizado mediante el componente oficial `ColorPicker` de PrimeNG (`<p-colorpicker>`):

| ID | Nombre en Español | Nombre en Inglés | Color Hex Base | Clase Tailwind Indicador |
|---|---|---|---|---|
| `violet` | Violeta | Violet | `#5E4DA2` | `bg-violet-600` |
| `indigo` | Índigo | Indigo | `#4F46E5` | `bg-indigo-500` |
| `blue` | Azul | Blue | `#2563EB` | `bg-blue-500` |
| `emerald` | Esmeralda | Emerald | `#059669` | `bg-emerald-500` |
| `amber` | Ámbar | Amber | `#D97706` | `bg-amber-500` |
| `rose` | Rosa | Rose | `#E11D48` | `bg-rose-500` |
| `custom` | Personalizado | Custom | Libre (`#RRGGBB`) | Variable vía `ColorPicker` |

### 3.3. Integración Tailwind CSS v4 + PrimeUI
El archivo `styles.css` integra `tailwindcss-primeui`:
```css
@import "tailwindcss";
@import "tailwindcss-primeui";
```
Esto mapea las variables CSS de PrimeNG (`--p-primary-50` a `--p-primary-950`, `--p-primary-color`, etc.) directamente a las utilidades de color de Tailwind (`text-primary-600`, `bg-primary-500`, `border-primary-500`, `focus:border-primary`, etc.).

---

## 4. Tipografía

La aplicación utiliza tres fuentes descargadas de Google Fonts:

1. **Titulares y Marca (`--font-display`)**: `'Plus Jakarta Sans'`, sans-serif.
   - Usado en: `h1`, `h2`, `h3`, `h4`, tarjetas destacadas.
   - Tracking: `-0.025em`.
2. **Cuerpo de Texto y UI (`--font-body` / `--font-sans`)**: `'Inter'`, sans-serif.
   - Usado en: labels, textos descriptivos, botones, tablas y formularios.
3. **Números y Datos Técnicos (`--font-mono`)**: `'JetBrains Mono'`, monospace.
   - Usado en: valores de contadores numéricos (horas, minutos de almuerzo), horas en timepickers, tokens y códigos.

---

## 5. Formas, Espaciado y Bordes

- **Radio de Bordes**:
  - Botones y controles de formulario estándar: `rounded-xl` (12px) o `rounded-2xl` (16px).
  - Tarjetas y contenedores de paso: `rounded-2xl` (16px) a `rounded-3xl` (24px).
  - Badges y botones circulares: `rounded-full`.
- **Bordes y Superficies**:
  - Modo claro: Fondos `bg-slate-50` / `bg-white`, bordes `border-slate-200/80` o `border-slate-100`.
  - Modo oscuro: Fondos `bg-zinc-900` / `bg-zinc-800/40`, bordes `border-zinc-800` o `border-zinc-700`.

---

## 6. Animaciones y Transiciones

- **Fade-In suave en cambios de paso / vista**:
  ```css
  .animate-fadeIn {
    animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  ```
- **Transición de Tema**:
  El `<body>` y contenedores principales tienen `transition: background-color 0.2s ease, color 0.2s ease` para que el cambio claro/oscuro sea gradual.

---

## 7. Iconografía

- Se utiliza exclusivamente la librería `@ng-icons/tabler-icons` con `@ng-icons/core`.
- Importar siempre los iconos específicos requeridos por el componente e inyectarlos localmente a través de `viewProviders: [provideIcons({ tablerIconName })]`.
- No importar iconos no utilizados en la plantilla.

### 7.1. Entradas (Inputs) Soportadas por `<ng-icon>`

El componente `<ng-icon>` expone los siguientes inputs nativos:

| Input | Tipo | Valor por Defecto | Descripción |
|---|---|---|---|
| `name` | `IconType` | — | Nombre del icono registrado previamente en `provideIcons`. Cuenta con autocompletado de TypeScript. |
| `svg` | `string` | — | Cadena SVG para renderizar directamente en lugar de un icono registrado. |
| `size` | `string` | Fuente actual (`1em`) | Tamaño del icono. Acepta cualquier longitud CSS válida (ej. `'1rem'`, `'1.25rem'`, `'1.5rem'`, `'20px'`). |
| `color` | `string` | Color de texto actual (`currentColor`) | Color del icono. Acepta cualquier color CSS o variable (ej. `'var(--p-primary-500)'`, `'#2563EB'`). |
| `strokeWidth` | `string \| number` | Depende del set | Grosor del trazo del icono. Aplica en sets basados en trazado como Tabler Icons (ej. `'1.5'`, `'2'`). |

### 7.2. Comportamiento y Directrices Obligatorias

1. **Uso Mandatario del Input `size` para Dimensionar**:
   - Para especificar el tamaño de un icono, utilice **siempre** el input `size` de `<ng-icon>` (ej. `size="1.15rem"` o `size="1.25rem"`).
   
2. **PROHIBIDO el uso de Clases Tipográficas de Tamaño (`text-xs`, `text-sm`, `text-base`, `text-lg`, etc.)**:
   > [!WARNING]
   > **NUNCA** aplique clases utilitarias de tamaño de fuente de Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, etc.) a la etiqueta `<ng-icon>`.
   > 
   > **Motivo técnico**: En Tailwind CSS, las clases `text-*` no solo asignan `font-size`, sino también un `line-height` específico (por ejemplo, `text-base` aplica `font-size: 1rem; line-height: 1.5rem;`). Esto genera un contenedor con altura de línea forzada que distorsiona la alineación vertical del SVG e impone restricciones de caja que cortan o impiden mostrar el icono completo.

3. **Manejo de Color**:
   - Puede asignarse mediante el input `color` (ej. `color="var(--p-primary-500)"`) o mediante clases de color de texto de Tailwind (ej. `class="text-primary-600 dark:text-primary-400"`), **sin mezclar con clases de tamaño tipográfico**.
   - Para márgenes y espaciado de diseño (ej. `mr-1.5`, `ml-auto`, `shrink-0`), se pueden usar clases de Tailwind en `class`.

4. **Grosor del Trazo (`strokeWidth`)**:
   - Como Tabler Icons es un conjunto basado en vectores de trazo (*stroke-based*), el grosor del trazo puede ajustarse limpiamente usando `strokeWidth="1.5"` o `strokeWidth="2"` según el peso visual deseado.

### 7.3. Ejemplos de Referencia

```html
<!-- CORRECTO: Uso del input size y clase de color o margen sin tamaño tipográfico -->
<ng-icon name="tablerSettings" size="1.15rem" class="mr-1.5 text-primary-500" />

<!-- CORRECTO: Icono en botón usando size nativo y strokeWidth -->
<button pButton iconOnly rounded severity="secondary" size="small">
  <ng-icon name="tablerLayoutSidebar" size="1.25rem" strokeWidth="1.75" />
</button>

<!-- CORRECTO: Icono con color mediante variable CSS -->
<ng-icon name="tablerCalendar" size="1.25rem" color="var(--p-primary-color)" />

<!-- INCORRECTO: Usar clases de tamaño tipográfico de Tailwind (recorta o desfasa el SVG) -->
<!-- ❌ <ng-icon name="tablerCalendar" class="text-base text-primary-500" /> -->
<!-- ❌ <ng-icon name="tablerLayoutSidebar" class="text-lg" /> -->
<!-- ❌ <ng-icon name="tablerSettings" class="text-sm" /> -->
```
