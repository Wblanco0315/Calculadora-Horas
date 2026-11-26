//! System tray icon and its menu.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

use crate::ipc;

pub(crate) fn build_tray(app: &App) -> tauri::Result<()> {
    let handle = app.handle();

    let show_item = MenuItem::with_id(handle, "show", "Abrir PocketProject", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(handle, "quit", "Salir", true, None::<&str>)?;
    let tray_menu = Menu::with_items(handle, &[&show_item, &quit_item])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&tray_menu)
        .tooltip("PocketProject")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.unminimize();
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "quit" => {
                    ipc::cleanup_ipc_file(app);
                    app.exit(0);
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let _tray = builder.build(app)?;

    Ok(())
}
