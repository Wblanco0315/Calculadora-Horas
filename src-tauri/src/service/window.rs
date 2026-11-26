//! Main window bounds for the compact/full mode switch.
//!
//! The frontend changes the window size between modes. Doing it with separate "set size" and
//! "set position" calls makes the window visibly jump (it grows from the top-left corner, then
//! moves). Here the final rectangle is computed first and applied in one native call
//! (`SetWindowPos` on Windows), so the window changes size around its own center in a single step.

use tauri::WebviewWindow;
#[cfg(not(windows))]
use tauri::{PhysicalPosition, PhysicalSize};

/// A rectangle in physical pixels (outer window bounds or a monitor work area).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// Outer bounds of a window of `width` x `height` that keeps the center of `current`
/// (or is centered in `work_area` when `center_in_work_area`) and fits inside `work_area`.
pub(crate) fn target_bounds(current: Bounds, work_area: Bounds, width: i32, height: i32, center_in_work_area: bool) -> Bounds {
    let width = width.min(work_area.width).max(1);
    let height = height.min(work_area.height).max(1);
    let (center_x, center_y) = if center_in_work_area {
        (work_area.x + work_area.width / 2, work_area.y + work_area.height / 2)
    } else {
        (current.x + current.width / 2, current.y + current.height / 2)
    };
    let max_x = work_area.x + work_area.width - width;
    let max_y = work_area.y + work_area.height - height;
    Bounds {
        x: (center_x - width / 2).clamp(work_area.x, max_x),
        y: (center_y - height / 2).clamp(work_area.y, max_y),
        width,
        height,
    }
}

/// Resizes the window so its content area is `width` x `height` logical pixels, keeping the window
/// center (or centering it in the monitor work area) and staying on the current monitor.
pub(crate) fn resize(window: &WebviewWindow, width: f64, height: f64, center_in_work_area: bool) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    let current = Bounds {
        x: position.x,
        y: position.y,
        width: outer.width as i32,
        height: outer.height as i32,
    };
    let work_area = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .map(|monitor| {
            let area = monitor.work_area();
            Bounds {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width as i32,
                height: area.size.height as i32,
            }
        })
        .unwrap_or(current);

    // Requested size is the content area; keep the frame the window already has (0 when undecorated).
    let frame_width = outer.width.saturating_sub(inner.width) as i32;
    let frame_height = outer.height.saturating_sub(inner.height) as i32;
    let target = target_bounds(
        current,
        work_area,
        (width * scale).round() as i32 + frame_width,
        (height * scale).round() as i32 + frame_height,
        center_in_work_area,
    );
    set_outer_bounds(window, target)
}

/// Work area of the window's monitor and that monitor's origin, in physical px.
fn monitor_areas(window: &WebviewWindow) -> Result<Option<(Bounds, (i32, i32))>, String> {
    Ok(window.current_monitor().map_err(|e| e.to_string())?.map(|monitor| {
        let area = monitor.work_area();
        (
            Bounds {
                x: area.position.x,
                y: area.position.y,
                width: area.size.width as i32,
                height: area.size.height as i32,
            },
            (monitor.position().x, monitor.position().y),
        )
    }))
}

/// Sets the size a **maximized** window gets back when it is un-maximized (dragged, double-clicked
/// or restored), without un-maximizing it: `width` x `height` logical px, around the center of the
/// current restore rectangle or centered in the monitor work area. No-op when not maximized.
pub(crate) fn set_restore_size(window: &WebviewWindow, width: f64, height: f64, center_in_work_area: bool) -> Result<(), String> {
    if !window.is_maximized().map_err(|e| e.to_string())? {
        return Ok(());
    }
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let Some((work_area, monitor_origin)) = monitor_areas(window)? else {
        return Ok(());
    };
    set_restore_rect(
        window,
        work_area,
        monitor_origin,
        (width * scale).round() as i32,
        (height * scale).round() as i32,
        center_in_work_area,
    )
}

#[cfg(windows)]
fn set_restore_rect(
    window: &WebviewWindow,
    work_area: Bounds,
    monitor_origin: (i32, i32),
    width: i32,
    height: i32,
    center_in_work_area: bool,
) -> Result<(), String> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowPlacement, SetWindowPlacement, WINDOWPLACEMENT};

    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let mut placement = WINDOWPLACEMENT {
        length: std::mem::size_of::<WINDOWPLACEMENT>() as u32,
        ..Default::default()
    };
    // SAFETY: `hwnd` is the live handle of this window and `placement` is a properly sized struct.
    unsafe { GetWindowPlacement(hwnd, &mut placement) }.map_err(|e| e.to_string())?;

    // rcNormalPosition is in workspace coordinates: screen coordinates minus the offset of the
    // monitor's work area (e.g. a taskbar on the top or left edge).
    let offset_x = work_area.x - monitor_origin.0;
    let offset_y = work_area.y - monitor_origin.1;
    let normal = placement.rcNormalPosition;
    let current = Bounds {
        x: normal.left + offset_x,
        y: normal.top + offset_y,
        width: normal.right - normal.left,
        height: normal.bottom - normal.top,
    };
    let target = target_bounds(current, work_area, width, height, center_in_work_area);
    placement.rcNormalPosition = RECT {
        left: target.x - offset_x,
        top: target.y - offset_y,
        right: target.x - offset_x + target.width,
        bottom: target.y - offset_y + target.height,
    };
    // Keep showCmd (maximized): only the restore rectangle changes.
    placement.flags = Default::default();
    // SAFETY: same handle; the struct comes from GetWindowPlacement with only the rectangle changed.
    unsafe { SetWindowPlacement(hwnd, &placement) }.map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn set_restore_rect(
    _window: &WebviewWindow,
    _work_area: Bounds,
    _monitor_origin: (i32, i32),
    _width: i32,
    _height: i32,
    _center_in_work_area: bool,
) -> Result<(), String> {
    // Other platforms restore to the size the window had before maximizing.
    Ok(())
}

/// Moves and resizes the window to logical `x`, `y`, `width`, `height` (content size) in one step.
pub(crate) fn set_bounds(window: &WebviewWindow, x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let outer = window.outer_size().map_err(|e| e.to_string())?;
    let inner = window.inner_size().map_err(|e| e.to_string())?;
    set_outer_bounds(
        window,
        Bounds {
            x: (x * scale).round() as i32,
            y: (y * scale).round() as i32,
            width: (width * scale).round() as i32 + outer.width.saturating_sub(inner.width) as i32,
            height: (height * scale).round() as i32 + outer.height.saturating_sub(inner.height) as i32,
        },
    )
}

#[cfg(windows)]
fn set_outer_bounds(window: &WebviewWindow, bounds: Bounds) -> Result<(), String> {
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, SWP_NOACTIVATE, SWP_NOOWNERZORDER, SWP_NOZORDER,
    };
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    // SAFETY: `hwnd` is the live handle of this Tauri window; SetWindowPos only reads the arguments.
    unsafe {
        SetWindowPos(
            hwnd,
            None,
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            SWP_NOZORDER | SWP_NOOWNERZORDER | SWP_NOACTIVATE,
        )
    }
    .map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn set_outer_bounds(window: &WebviewWindow, bounds: Bounds) -> Result<(), String> {
    window
        .set_position(PhysicalPosition::new(bounds.x, bounds.y))
        .map_err(|e| e.to_string())?;
    window
        .set_size(PhysicalSize::new(bounds.width as u32, bounds.height as u32))
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const AREA: Bounds = Bounds { x: 0, y: 0, width: 1920, height: 1040 };

    #[test]
    fn grows_around_the_window_center() {
        let compact = Bounds { x: 700, y: 120, width: 525, height: 800 };
        let full = target_bounds(compact, AREA, 1150, 780, false);
        assert_eq!(full, Bounds { x: 387, y: 130, width: 1150, height: 780 });
    }

    #[test]
    fn stays_inside_the_work_area() {
        let near_edge = Bounds { x: 1500, y: 600, width: 400, height: 400 };
        let full = target_bounds(near_edge, AREA, 1150, 780, false);
        assert_eq!(full.x + full.width, 1920);
        assert_eq!(full.y + full.height, 1040);

        let too_big = target_bounds(near_edge, AREA, 4000, 3000, false);
        assert_eq!(too_big, AREA);
    }

    #[test]
    fn works_on_a_secondary_monitor() {
        let area = Bounds { x: -1920, y: 0, width: 1920, height: 1040 };
        let compact = Bounds { x: -1200, y: 200, width: 525, height: 800 };
        let full = target_bounds(compact, area, 1150, 780, false);
        assert!(full.x >= -1920 && full.x + full.width <= 0);
    }

    #[test]
    fn centers_in_the_work_area_when_asked() {
        let anywhere = Bounds { x: 10, y: 10, width: 300, height: 300 };
        let compact = target_bounds(anywhere, AREA, 525, 800, true);
        assert_eq!(compact, Bounds { x: 698, y: 120, width: 525, height: 800 });
    }
}
