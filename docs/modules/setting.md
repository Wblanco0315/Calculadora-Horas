# Módulo: Setting (Ajustes y Configuración del Sistema)

El módulo `setting` centraliza la gestión de configuración de **PocketProject** en una vista organizada por pestañas (`p-tabs`). Se estructura siguiendo una arquitectura modular con componentes independientes por cada pestaña o sección (`user-section` y `system-section`), facilitando su mantenimiento y escalabilidad.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/setting/`
- **Ruta de Navegación**: `/dashboard/settings` (con alias `/dashboard/setting` en `dashboard.router.ts`)

```
src/app/modules/setting/
├── components/
│   ├── user-section/
│   │   └── user-section.component.ts       # Sección 'User': datos de perfil y gestión de horario
│   ├── system-section/
│   │   └── system-section.component.ts     # Sección 'System': apariencia, idioma, OpenProject y actualizaciones
│   └── update-section/
│       └── update-section.component.ts     # Tarjeta de comprobación e instalación de actualizaciones
├── pages/
│   ├── setting.page.html                   # Vista orquestadora con p-tabs y routing de secciones
│   ├── setting.page.ts                     # Smart component con lectura de query params (?tab=)
│   └── setting.page.css                    # Estilos encapsulados de la página
└── setting.router.ts                       # Enrutador del módulo con carga diferida
```

---

## 2. Componentes de Sección del Módulo

### 2.1. Sección de Usuario (`app-user-section`)
- **Ubicación**: `src/app/modules/setting/components/user-section/user-section.component.ts`
- **Responsabilidad**:
  - Aloja la tarjeta de perfil [user-card.component.ts](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/shared/components/user-card/user-card.component.ts) con avatar, nombre editable, login de OpenProject y métricas rápidas.
  - Integra el editor de jornada laboral [schedule-editor.component.ts](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/shared/components/schedule-editor/schedule-editor.component.ts) con soporte para entrada/salida, días agrupados y tiempo de descanso/almuerzo (`[showLunch]="true"`).
  - Gestiona el guardado persistente del horario (`saveSchedule()`) con notificaciones de éxito reactivas.

### 2.2. Sección de Sistema (`app-system-section`)
- **Ubicación**: `src/app/modules/setting/components/system-section/system-section.component.ts`
- **Responsabilidad**:
  - Disposición en cuadrícula responsiva (1 columna en móvil, 2 columnas en escritorio).
  - Aloja [appearance-editor.component.ts](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/shared/components/appearance-editor/appearance-editor.component.ts) para el control de modo de tema (Sistema, Claro, Oscuro), idioma de interfaz (`p-select`) y color de acento con selector de paleta y hexadecimal.
  - Aloja [openproject-connection.component.ts](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/shared/components/openproject-connection/openproject-connection.component.ts) para el endpoint del servidor, token de acceso personal con máscara, prueba de conectividad y guardado.
  - Aloja [update-section.component.ts](file:///c:/Users/wposs/Documents/Proyectos_personales/PocketProject/src/app/modules/setting/components/update-section/update-section.component.ts) para consultar la versión instalada, verificar disponibilidad de nuevas versiones en GitHub Releases e iniciar la descarga e instalación.

---

## 3. Componentes Compartidos Reutilizables

El módulo reutiliza componentes transversales ubicados en `src/app/shared/components/`:
- `UserCardComponent` (`user-card.component.ts`)
- `ScheduleEditorComponent` (`schedule-editor.component.ts`)
- `AppearanceEditorComponent` (`appearance-editor.component.ts`)
- `OpenprojectConnectionComponent` (`openproject-connection.component.ts`)
- `UpdateDialogComponent` (`update-dialog.component.ts`)

---

## 4. Pestañas y Navegación Reactiva

Implementa `<p-tabs>` de PrimeNG sincronizado bidireccionalmente con la URL:
- `/dashboard/settings?tab=user` activa la pestaña **User**.
- `/dashboard/settings?tab=system` activa la pestaña **System**.
- Al interactuar con las pestañas, se actualiza el parámetro de la URL mediante `onTabChange()` sin recargar la página, sincronizando de inmediato el breadcrumb en el encabezado del Dashboard.
- **Garantía de Visualización Permanente de Navegación**: El componente `p-tablist` cuenta con protección contra colapso flex (`shrink-0` y `flex-shrink: 0 !important; min-height: 44px`) y anclaje superior (`sticky top-0 z-10`), asegurando que la barra de navegación nunca se oculte ni colapse en pantallas de computadoras portátiles (laptops) o con espacio vertical reducido; el desplazamiento vertical (`overflow-y-auto`) se aísla de forma exclusiva en `p-tabpanels`.
