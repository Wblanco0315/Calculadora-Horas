//! System tray icon and its menu.

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App,
};

use crate::app::window::show_main_window;
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
                show_main_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => show_main_window(app),
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
