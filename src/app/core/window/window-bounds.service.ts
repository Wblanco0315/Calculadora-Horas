import { Injectable } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { availableMonitors, getCurrentWindow } from '@tauri-apps/api/window';
import {
  BOUNDS_SAVE_DEBOUNCE_MS,
  LEGACY_WINDOW_STORAGE_KEYS,
  WINDOW_BOUNDS_STORAGE_KEY,
} from './window.constants';

/** Normal (non-maximized) bounds in logical px plus whether the window was maximized. */
interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

/**
 * Native window geometry: maximized state, single-step resizes (Rust `resize_window` /
 * `set_window_bounds`, one `SetWindowPos` on Windows) and the last bounds, which are tracked on
 * every move/resize and restored on the next start. Every method is a no-op outside Tauri.
 */
@Injectable({ providedIn: 'root' })
export class WindowBoundsService {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** While true, moves/resizes made by the app itself are not stored. */
  private paused = false;

  constructor() {
    if (typeof window !== 'undefined') {
      for (const key of LEGACY_WINDOW_STORAGE_KEYS) localStorage.removeItem(key);
    }
    this.trackBounds();
  }

  async isMaximized(): Promise<boolean> {
    if (!isTauri()) return false;
    try {
      return await getCurrentWindow().isMaximized();
    } catch {
      return false;
    }
  }

  async maximize(): Promise<void> {
    if (!isTauri()) return;
    await getCurrentWindow().maximize();
  }

  async unmaximize(): Promise<void> {
    if (!isTauri()) return;
    await getCurrentWindow().unmaximize();
  }

  /**
   * Resizes the content area to `width` x `height` in one step, keeping the window center (or
   * centering it in the monitor work area) and staying on the current monitor.
   */
  async resize(width: number, height: number, options: { center?: boolean } = {}): Promise<void> {
    if (!isTauri()) return;
    await this.withoutTracking(() => invoke('resize_window', { width, height, center: !!options.center }));
  }

  /**
   * While maximized, sets the size (logical content px) the window gets back when it is
   * un-maximized (drag, double-click, restore), without un-maximizing it. No-op when not maximized.
   */
  async setRestoreSize(width: number, height: number, options: { center?: boolean } = {}): Promise<void> {
    if (!isTauri()) return;
    await invoke('set_window_restore_size', { width, height, center: !!options.center });
  }

  /**
   * Startup and webview reloads (Ctrl+Shift+R): the window always gets the mode's default content
   * size (`width` x `height`); only where it was (its center, on a connected monitor) and whether it
   * was maximized are restored. Without usable saved bounds it is centered on its monitor.
   * - Saved maximized and still maximized (a reload): stays maximized; its restore size is set.
   * - Saved maximized: placed and resized first, then maximized (un-maximizing returns there).
   * - Otherwise: un-maximized if needed (Rust), moved to the saved place and resized around it.
   */
  async restorePlacement(width: number, height: number): Promise<void> {
    if (!isTauri()) return;
    const saved = this.readBounds();
    const usable = !!saved && (await this.isOnScreen(saved));
    const maximized = await this.isMaximized();
    await this.withoutTracking(async () => {
      if (usable && saved.maximized && maximized) {
        await invoke('set_window_restore_size', { width, height, center: false });
        return;
      }
      if (usable) {
        await invoke('set_window_bounds', { x: saved.x, y: saved.y, width: saved.width, height: saved.height });
        await invoke('resize_window', { width, height, center: false });
      } else {
        await invoke('resize_window', { width, height, center: true });
      }
      if (usable && saved.maximized) await getCurrentWindow().maximize();
    });
  }

  // ──────────────────────────────────────────────
  // Last bounds tracking
  // ──────────────────────────────────────────────

  private trackBounds(): void {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const schedule = () => {
      if (this.paused) return;
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        void this.saveBounds();
      }, BOUNDS_SAVE_DEBOUNCE_MS);
    };
    win.onMoved(schedule).catch((err) => console.warn('Error tracking window moves:', err));
    win.onResized(schedule).catch((err) => console.warn('Error tracking window resizes:', err));
  }

  /** Runs a native change without storing its intermediate states, then stores the result. */
  private async withoutTracking<T>(change: () => Promise<T>): Promise<T> {
    this.paused = true;
    try {
      return await change();
    } finally {
      setTimeout(() => {
        this.paused = false;
        void this.saveBounds();
      }, BOUNDS_SAVE_DEBOUNCE_MS);
    }
  }

  private readBounds(): WindowBounds | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(WINDOW_BOUNDS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as WindowBounds) : null;
    } catch {
      return null;
    }
  }

  private async saveBounds(): Promise<void> {
    if (!isTauri() || typeof window === 'undefined') return;
    try {
      const win = getCurrentWindow();
      if (!(await win.isVisible()) || (await win.isMinimized())) return;
      const previous = this.readBounds();
      let bounds: WindowBounds;
      if (await win.isMaximized()) {
        // Keep the last normal bounds so the next start restores (and un-maximizes) there.
        if (!previous) return;
        bounds = { ...previous, maximized: true };
      } else {
        const scale = await win.scaleFactor();
        const position = (await win.outerPosition()).toLogical(scale);
        const size = (await win.innerSize()).toLogical(scale);
        bounds = {
          x: Math.round(position.x),
          y: Math.round(position.y),
          width: Math.round(size.width),
          height: Math.round(size.height),
          maximized: false,
        };
      }
      localStorage.setItem(WINDOW_BOUNDS_STORAGE_KEY, JSON.stringify(bounds));
    } catch (err) {
      console.warn('Error saving window bounds:', err);
    }
  }

  /** Whether the title bar area of `bounds` is on a connected monitor. */
  private async isOnScreen(bounds: WindowBounds): Promise<boolean> {
    try {
      const px = bounds.x + Math.min(80, bounds.width / 2);
      const py = bounds.y + 16;
      return (await availableMonitors()).some((m) => {
        const position = m.position.toLogical(m.scaleFactor);
        const size = m.size.toLogical(m.scaleFactor);
        return px >= position.x && px < position.x + size.width && py >= position.y && py < position.y + size.height;
      });
    } catch {
      return false;
    }
  }
}
