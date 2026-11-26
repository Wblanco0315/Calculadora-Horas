import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { availableMonitors, currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize, Monitor } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export type AppViewMode = 'compact' | 'full';

export const COMPACT_WINDOW_WIDTH = 525;
export const COMPACT_WINDOW_HEIGHT = 800;
export const FULL_WINDOW_WIDTH = 1150;
export const FULL_WINDOW_HEIGHT = 780;

const VIEW_MODE_KEY = 'pocketproject_view_mode';
// v2: logical units (v1 stored physical pixels and shrank the window on scaled displays).
const GEOMETRY_KEY_PREFIX = 'pocketproject_window_geometry_v2_';
const LEGACY_GEOMETRY_KEY_PREFIX = 'pocketproject_window_geometry_';
/** Smallest full-mode size that is restored; anything smaller falls back to the default. */
const FULL_MIN_WIDTH = 760;
const FULL_MIN_HEIGHT = 520;
const GEOMETRY_SAVE_DEBOUNCE_MS = 400;
/** Cover fade-in/out (matches the overlay's 150 ms opacity transition). */
const TRANSITION_FADE_MS = 160;
/** Time for the hidden webview to lay out the new route at the new size before showing it. */
const TRANSITION_SETTLE_MS = 180;

/** Last normal (non-maximized) bounds of a view mode, in logical pixels, plus whether it was maximized. */
interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  maximized: boolean;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable({
  providedIn: 'root',
})
export class WindowService {
  private readonly router = inject(Router);

  readonly viewMode = signal<AppViewMode>(this.getInitialViewMode());
  readonly showCloseModal = signal<boolean>(false);
  /** True while the window is switching mode: `app-window-transition` covers the content. */
  readonly isTransitioning = signal<boolean>(false);

  private geometryTimer: ReturnType<typeof setTimeout> | null = null;
  /** True while a mode switch is resizing/moving the window, so its intermediate states are not saved. */
  private applyingGeometry = false;
  /**
   * Monitor the window was on when a mode switch started (read while still visible). The switch
   * keeps the window on it; null on startup, where the saved position decides the monitor.
   */
  private transitionMonitor: Monitor | null = null;

  constructor() {
    this.initCloseListener();
    this.initGeometryTracking();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(LEGACY_GEOMETRY_KEY_PREFIX + 'compact');
      localStorage.removeItem(LEGACY_GEOMETRY_KEY_PREFIX + 'full');
    }
  }

  /**
   * Remembers the size and position of each view mode: every move/resize (debounced) is stored
   * for the current mode, so switching modes or restarting the app restores where the user left it.
   */
  private initGeometryTracking(): void {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    const schedule = () => {
      if (this.applyingGeometry) return;
      if (this.geometryTimer) clearTimeout(this.geometryTimer);
      this.geometryTimer = setTimeout(() => {
        this.geometryTimer = null;
        void this.saveGeometry(this.viewMode());
      }, GEOMETRY_SAVE_DEBOUNCE_MS);
    };
    win.onMoved(schedule).catch((err) => console.warn('Error tracking window moves:', err));
    win.onResized(schedule).catch((err) => console.warn('Error tracking window resizes:', err));
  }

  private readGeometry(mode: AppViewMode): WindowGeometry | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(GEOMETRY_KEY_PREFIX + mode);
      return raw ? (JSON.parse(raw) as WindowGeometry) : null;
    } catch {
      return null;
    }
  }

  private async saveGeometry(mode: AppViewMode): Promise<void> {
    if (!isTauri() || typeof window === 'undefined') return;
    try {
      const win = getCurrentWindow();
      if (!(await win.isVisible()) || (await win.isMinimized())) return;
      const maximized = await win.isMaximized();
      const previous = this.readGeometry(mode);
      let geometry: WindowGeometry;
      if (maximized) {
        // Keep the last normal bounds so un-maximizing later returns there.
        if (!previous) return;
        geometry = { ...previous, maximized: true };
      } else {
        const scale = await win.scaleFactor();
        const position = (await win.outerPosition()).toLogical(scale);
        const size = (await win.innerSize()).toLogical(scale);
        geometry = {
          x: Math.round(position.x),
          y: Math.round(position.y),
          width: Math.round(size.width),
          height: Math.round(size.height),
          maximized: false,
        };
      }
      localStorage.setItem(GEOMETRY_KEY_PREFIX + mode, JSON.stringify(geometry));
    } catch (err) {
      console.warn('Error saving window geometry:', err);
    }
  }

  /** Whether the title bar area of `geometry` lies on `monitor`. */
  private static isOnMonitor(geometry: WindowGeometry, monitor: Monitor): boolean {
    const px = geometry.x + Math.min(80, geometry.width / 2);
    const py = geometry.y + 16;
    const position = monitor.position.toLogical(monitor.scaleFactor);
    const size = monitor.size.toLogical(monitor.scaleFactor);
    return px >= position.x && px < position.x + size.width && py >= position.y && py < position.y + size.height;
  }

  /**
   * Whether the saved geometry can be restored: on the monitor of the current switch, or on any
   * connected monitor at startup.
   */
  private async isOnScreen(geometry: WindowGeometry): Promise<boolean> {
    if (this.transitionMonitor) return WindowService.isOnMonitor(geometry, this.transitionMonitor);
    try {
      const monitors = await availableMonitors();
      return monitors.some((m) => WindowService.isOnMonitor(geometry, m));
    } catch {
      return false;
    }
  }

  /** Centers a window of `size` in the work area of the switch's monitor (or the OS default monitor). */
  private async centerOnMonitor(size: LogicalSize): Promise<void> {
    const win = getCurrentWindow();
    const monitor = this.transitionMonitor;
    if (!monitor) {
      await win.center();
      return;
    }
    const area = monitor.workArea.position.toLogical(monitor.scaleFactor);
    const areaSize = monitor.workArea.size.toLogical(monitor.scaleFactor);
    await win.setPosition(
      new LogicalPosition(
        Math.round(area.x + Math.max(0, (areaSize.width - size.width) / 2)),
        Math.round(area.y + Math.max(0, (areaSize.height - size.height) / 2)),
      ),
    );
  }

  /**
   * Restores where a mode was left, or its default size centered when nothing is saved (or it is
   * off-screen, e.g. a disconnected monitor). `reset` ignores the saved geometry.
   * - Compact: always the fixed 525x800 size; only the position (and maximized state) is restored.
   * - Full: size and position, as long as the size is at least 760x520.
   * Returns whether the mode was left maximized; the caller maximizes once the window is shown.
   */
  private async applyGeometry(mode: AppViewMode, reset = false): Promise<boolean> {
    if (!isTauri()) return false;
    this.applyingGeometry = true;
    let maximize = false;
    try {
      const win = getCurrentWindow();
      const saved = reset ? null : this.readGeometry(mode);
      await win.unmaximize();
      const defaultSize =
        mode === 'full'
          ? new LogicalSize(FULL_WINDOW_WIDTH, FULL_WINDOW_HEIGHT)
          : new LogicalSize(COMPACT_WINDOW_WIDTH, COMPACT_WINDOW_HEIGHT);
      if (saved && (await this.isOnScreen(saved))) {
        const keepSize = mode === 'full' && saved.width >= FULL_MIN_WIDTH && saved.height >= FULL_MIN_HEIGHT;
        await win.setSize(keepSize ? new LogicalSize(saved.width, saved.height) : defaultSize);
        await win.setPosition(new LogicalPosition(saved.x, saved.y));
        maximize = saved.maximized;
      } else {
        await win.setSize(defaultSize);
        await this.centerOnMonitor(defaultSize);
      }
    } catch (err) {
      console.warn(`Error adjusting window to ${mode} mode:`, err);
    } finally {
      // Let the resize/move events of this switch settle before tracking again.
      setTimeout(() => {
        this.applyingGeometry = false;
        void this.saveGeometry(this.viewMode());
      }, GEOMETRY_SAVE_DEBOUNCE_MS);
    }
    return maximize;
  }

  /** On startup: puts the window where the current mode was left (or its default size, centered). */
  async restoreWindow(): Promise<void> {
    await this.withTransition(() => this.applyGeometry(this.viewMode()), { keepMonitor: false });
  }

  /** Puts a hidden window over the work area of its monitor, so maximizing it after showing is not animated. */
  private async coverWorkArea(): Promise<void> {
    try {
      const monitor = this.transitionMonitor ?? (await currentMonitor());
      if (!monitor) return;
      const win = getCurrentWindow();
      await win.setPosition(monitor.workArea.position);
      await win.setSize(monitor.workArea.size);
    } catch {
      // Not critical: maximize() still works, only with the OS animation.
    }
  }

  /**
   * Leaves the compact settings (`/setup?edit=true`) back to the compact view. The window keeps
   * its current size, position and maximized state: settings are part of the compact window.
   */
  async returnToCompact(): Promise<void> {
    await this.router.navigate(['/compact']);
  }

  /**
   * Saves the geometry of the mode being left, then applies the target mode's geometry.
   * Returns whether the target mode should end maximized.
   */
  private async switchMode(mode: AppViewMode, reset = false): Promise<boolean> {
    const previous = this.viewMode();
    if (previous !== mode) {
      if (this.geometryTimer) {
        clearTimeout(this.geometryTimer);
        this.geometryTimer = null;
      }
      await this.saveGeometry(previous);
    }
    this.viewMode.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    }
    return this.applyGeometry(mode, reset);
  }

  private initCloseListener(): void {
    if (isTauri()) {
      listen('close-requested', () => {
        this.requestClose();
      }).catch((err) => {
        console.warn('Error setting up close-requested listener:', err);
      });
    }
  }

  private getInitialViewMode(): AppViewMode {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      if (saved === 'compact' || saved === 'full') {
        return saved;
      }
    }
    return 'compact';
  }

  /**
   * Switch to Compact Mode. Restores where the compact window was left (default 525x800, centered).
   * `reset` (end of onboarding) ignores the saved geometry.
   */
  async setCompactMode(options: { reset?: boolean } = {}): Promise<void> {
    await this.withTransition(async () => {
      const maximize = await this.switchMode('compact', options.reset);
      await this.router.navigate(['/compact']);
      return maximize;
    });
  }

  /**
   * Mode switch without visible stretching or jumping:
   * 1. the cover (`app-window-transition`) fades in over the content;
   * 2. the window is hidden, so the resize, move and route change happen off-screen;
   * 3. after the new layout settles it is shown again (when it must end maximized, it is first
   *    placed over the monitor's work area so maximizing does not animate);
   * The window stays on the monitor it was on: the target mode's saved position is used only when
   * it is on that monitor, otherwise the default size is centered there (`keepMonitor: false` on
   * startup lets the saved position pick the monitor).
   * 4. the cover fades out over the new layout.
   * `change` returns whether the window must end maximized. Outside Tauri it just runs `change`.
   */
  private async withTransition(
    change: () => Promise<boolean | void>,
    options: { keepMonitor?: boolean } = {},
  ): Promise<void> {
    if (!isTauri() || this.isTransitioning()) {
      await change();
      return;
    }
    const win = getCurrentWindow();
    this.isTransitioning.set(true);
    let hidden = false;
    try {
      await delay(TRANSITION_FADE_MS);
      const wasVisible = await win.isVisible();
      // Read the monitor while the window is still visible: a hidden window reports the primary one.
      this.transitionMonitor = options.keepMonitor === false || !wasVisible ? null : await currentMonitor().catch(() => null);
      if (wasVisible) {
        // Save where the current mode is left now: a hidden window cannot be measured.
        if (this.geometryTimer) {
          clearTimeout(this.geometryTimer);
          this.geometryTimer = null;
        }
        await this.saveGeometry(this.viewMode());
        await win.hide();
        hidden = true;
      }
      const maximize = await change();
      await delay(TRANSITION_SETTLE_MS);
      // A window started hidden (tray, --minimized) stays hidden: maximize() would show it.
      if (maximize && wasVisible) await this.coverWorkArea();
      if (hidden) {
        await win.show();
        hidden = false;
        await win.setFocus();
      }
      if (maximize && wasVisible) await win.maximize();
      await delay(TRANSITION_FADE_MS);
    } catch (err) {
      console.warn('Error during window mode transition:', err);
    } finally {
      if (hidden) await win.show().catch(() => {});
      this.transitionMonitor = null;
      this.isTransitioning.set(false);
    }
  }

  /**
   * Switch to Full Mode (dashboard). Restores where the full window was left (default ~1150x780,
   * centered); `maximize` (the compact view's "Full mode" button) maximizes it afterwards.
   */
  async setFullMode(targetUrl: string = '/dashboard/overview', options: { maximize?: boolean } = {}): Promise<void> {
    await this.withTransition(async () => {
      const maximize = await this.switchMode('full');
      await this.router.navigateByUrl(targetUrl);
      return maximize || !!options.maximize;
    });
  }

  /**
   * Toggle between Compact and Full modes
   */
  async toggleViewMode(): Promise<void> {
    if (this.viewMode() === 'compact') {
      await this.setFullMode();
    } else {
      await this.setCompactMode();
    }
  }

  /**
   * Minimizes the window into the system tray / hidden icons.
   */
  async minimizeToTray(): Promise<void> {
    this.showCloseModal.set(false);
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.hide();
      } catch (err) {
        console.warn('Error hiding window to tray:', err);
      }
    }
  }

  /**
   * Minimizes the window. By default saves/hides into hidden icons (system tray).
   */
  async minimize(): Promise<void> {
    await this.minimizeToTray();
  }

  /**
   * Maximizes the application window.
   */
  async maximize(): Promise<void> {
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.maximize();
      } catch (err) {
        console.warn('Error maximizing window:', err);
      }
    }
  }

  /**
   * Unmaximizes / restores the window to its non-maximized state.
   */
  async unmaximize(): Promise<void> {
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.unmaximize();
      } catch (err) {
        console.warn('Error unmaximizing window:', err);
      }
    }
  }

  /**
   * Toggles the window between maximized and restored states.
   */
  async toggleMaximize(): Promise<void> {
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.toggleMaximize();
      } catch (err) {
        console.warn('Error toggling maximize state:', err);
      }
    }
  }

  /**
   * Checks whether the window is currently maximized.
   */
  async isMaximized(): Promise<boolean> {
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        return await win.isMaximized();
      } catch (err) {
        console.warn('Error checking isMaximized:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Opens confirmation modal before closing
   */
  requestClose(): void {
    this.showCloseModal.set(true);
  }

  /**
   * Dismisses close confirmation modal
   */
  cancelClose(): void {
    this.showCloseModal.set(false);
  }

  /**
   * Closes / terminates the application completely
   */
  async confirmExit(): Promise<void> {
    this.showCloseModal.set(false);
    if (isTauri()) {
      try {
        await invoke('exit_app');
      } catch (err) {
        console.warn('Error invoking exit_app, attempting window destroy fallback:', err);
        try {
          await getCurrentWindow().destroy();
        } catch (destroyErr) {
          console.warn('Error destroying window:', destroyErr);
        }
      }
    }
  }

  /**
   * Close trigger: requests confirmation modal
   */
  close(): void {
    this.requestClose();
  }

  /**
   * Safe window dragging handler.
   * Can accept a MouseEvent to validate mouse button and filter out interactive targets.
   * Also unmaximizes if dragged while maximized, matching native Windows behavior.
   */
  async startDragging(event?: MouseEvent): Promise<void> {
    if (event) {
      if (event.button !== 0) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [data-no-drag]')) {
        return;
      }
    }

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        if (await win.isMaximized()) {
          await win.unmaximize();
        }
        await win.startDragging();
      } catch (err) {
        console.warn('Error starting Tauri window drag:', err);
      }
    }
  }
}
