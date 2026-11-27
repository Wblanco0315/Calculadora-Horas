# Módulo: Setting (Configuración en modo completo)

El módulo `setting` muestra la configuración de **PocketProject** dentro del dashboard. No tiene secciones propias: usa el mismo panel que la ventana compacta (`SettingsPanelComponent` del módulo `setup`), así que ambos modos comparten exactamente las mismas pestañas, componentes y estado; solo cambia la disposición.

---

## 1. Ubicación y Estructura

- **Ruta del Módulo**: `src/app/modules/setting/`
- **Ruta de Navegación**: `/dashboard/settings` (con alias `/dashboard/setting` en `dashboard.routes.ts`)

```
src/app/modules/setting/
├── pages/
│   └── setting/setting.page.{ts,html,css}  # Título + <app-settings-panel layout="full" />, sincroniza ?tab=
└── setting.routes.ts                       # Enrutador del módulo con carga diferida
```

---

## 2. Panel compartido (`app-settings-panel`)

- **Ubicación**: `src/app/modules/setup/components/settings-panel/settings-panel.component.{ts,html}`.
- **Pestañas** (`SETTINGS_TABS`, `p-tabs` desplazable): Apariencia, Horario, Almuerzo, OpenProject, Actualizaciones y Servidor MCP & IA. Cada pestaña es el mismo componente de paso del setup (`appearance-step`, `schedule-step`, `lunch-step`, `openproject-step`, `update-section`, `mcp-section`).
- **Estado**: `SetupService` (borrador de toda la configuración). La página llama a `SetupService.init()` al entrar para cargar la configuración guardada.
- **Guardar**: un único botón guarda todas las pestañas.
  - `layout="compact"` (ventana compacta, `/setup?edit=true`): botón **Cerrar**; al guardar (`saveSettings()`) o cerrar, `WindowService.returnToCompact()` vuelve a `/compact` sin tocar el tamaño, la posición ni el maximizado de la ventana.
  - `layout="full"` (dashboard): sin botón Cerrar; `saveSettings()` guarda sin cambiar de ventana y muestra el toast `toast.settingsSaved`.
- **Responsive**: en compacto ocupa la ventana con contenido `max-w-4xl`; en completo se muestra como tarjeta con bordes dentro del dashboard, contenido `max-w-5xl` y la barra de pestañas con desplazamiento horizontal en anchos pequeños.

---

## 3. Pestaña en la URL y breadcrumb

- `?tab=` acepta `appearance`, `schedule`, `lunch`, `openproject`, `update` o `mcp` (`SETTINGS_TABS[].key`). Al entrar con `?tab=` se activa esa pestaña; al cambiar de pestaña la URL se actualiza (`replaceUrl`).
- El breadcrumb del dashboard muestra `Configuración > {pestaña}` usando las etiquetas `setup.step1`…`setup.step6`.
- El menú de cuenta del pie de la barra lateral abre **Horario** (`?tab=schedule`) y **Configuración** (`?tab=appearance`).
