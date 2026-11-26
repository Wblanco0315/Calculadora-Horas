import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { WindowBoundsService } from './window-bounds.service';
import {
  AppViewMode,
  TRANSITION_FADE_MS,
  TRANSITION_SETTLE_MS,
  VIEW_MODE_STORAGE_KEY,
  WINDOW_SIZE,
} from './window.constants';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Behaviour of the main window: view mode (compact / full), mode switches, startup placement,
 * close confirmation, tray, maximize and dragging. Native geometry lives in `WindowBoundsService`.
 *
 * Mode switch rules:
 * - The cover (`app-window-transition`, `isTransitioning`) hides the content while it changes.
 * - Every mode has one default size (`WINDOW_SIZE`); un-maximizing always returns to the size of
 *   the current mode, never to the other mode's size.
 * - Compact → full while maximized: it stays maximized (only the route changes); its restore size
 *   becomes the full size.
 * - Full → compact while maximized: it is un-maximized straight to the compact size, centered.
 * - Normal window: one native resize to the mode's size, around the window's own center and inside
 *   the current monitor (no hide/show, no separate move + resize, so it does not jump). With
 *   `maximize` it is resized first and then maximized, so its restore size is the full size.
 * - Compact settings (`/setup?edit=true`) belong to the compact window: leaving them never resizes.
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly router = inject(Router);
  private readonly bounds = inject(WindowBoundsService);

  readonly viewMode = signal<AppViewMode>(this.getInitialViewMode());
  readonly showCloseModal = signal<boolean>(false);
  /** True while the window is switching mode: `app-window-transition` covers the content. */
  readonly isTransitioning = signal<boolean>(false);

  constructor() {
    this.initCloseListener();
  }

  // ──────────────────────────────────────────────
  // View modes
  // ──────────────────────────────────────────────

  /**
   * Startup (behind the index.html loader): restores the last window bounds, or the current mode's
   * default size centered when nothing usable is saved, and opens the dashboard in full mode.
   */
  async restoreWindow(): Promise<void> {
    try {
      if (!(await this.bounds.restoreLastBounds())) {
        const size = WINDOW_SIZE[this.viewMode()];
        await this.bounds.resize(size.width, size.height, { center: true });
      }
    } catch (err) {
      console.warn('Error restoring the window:', err);
    }
    if (this.viewMode() === 'full' && !this.router.url.startsWith('/dashboard')) {
      await this.router.navigateByUrl('/dashboard/overview');
    }
  }

  /**
   * Switch to compact mode. `reset` (end of onboarding, which runs maximized) un-maximizes and
   * centers the default compact size.
   */
  async setCompactMode(options: { reset?: boolean } = {}): Promise<void> {
    await this.switchMode('compact', () => this.router.navigate(['/compact']), { reset: options.reset });
  }

  /** Switch to full mode. `maximize` (the compact view's "Full mode" button) ends maximized. */
  async setFullMode(targetUrl: string = '/dashboard/overview', options: { maximize?: boolean } = {}): Promise<void> {
    await this.switchMode('full', () => this.router.navigateByUrl(targetUrl), { maximize: options.maximize });
  }

  async toggleViewMode(): Promise<void> {
    if (this.viewMode() === 'compact') {
      await this.setFullMode();
    } else {
      await this.setCompactMode();
    }
  }

  /** Leaves the compact settings back to the compact view; the window is not touched. */
  async returnToCompact(): Promise<void> {
    await this.router.navigate(['/compact']);
  }

  private async switchMode(
    mode: AppViewMode,
    navigate: () => Promise<unknown>,
    options: { maximize?: boolean; reset?: boolean },
  ): Promise<void> {
    this.setViewMode(mode);
    await this.withCover(async () => {
      try {
        const size = WINDOW_SIZE[mode];
        const maximized = await this.bounds.isMaximized();
        if (options.reset) {
          await this.bounds.unmaximize();
          await this.bounds.resize(size.width, size.height, { center: true });
        } else if (maximized && mode === 'compact') {
          await this.bounds.setRestoreSize(size.width, size.height, { center: true });
          await this.bounds.unmaximize();
        } else if (maximized) {
          await this.bounds.setRestoreSize(size.width, size.height);
        } else {
          await this.bounds.resize(size.width, size.height);
          if (options.maximize) await this.bounds.maximize();
        }
      } catch (err) {
        console.warn(`Error adjusting the window to ${mode} mode:`, err);
      }
      await navigate();
    });
  }

  /** Covers the content, runs `change`, lets the new layout settle and uncovers it. */
  private async withCover(change: () => Promise<void>): Promise<void> {
    if (!isTauri() || this.isTransitioning()) {
      await change();
      return;
    }
    this.isTransitioning.set(true);
    try {
      await delay(TRANSITION_FADE_MS);
      await change();
      await delay(TRANSITION_SETTLE_MS);
    } finally {
      this.isTransitioning.set(false);
    }
  }

  private setViewMode(mode: AppViewMode): void {
    this.viewMode.set(mode);
    if (typeof window !== 'undefined') localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  private getInitialViewMode(): AppViewMode {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'compact' || saved === 'full') return saved;
    }
    return 'compact';
  }

  // ──────────────────────────────────────────────
  // Maximize, tray, dragging
  // ──────────────────────────────────────────────

  async maximize(): Promise<void> {
    try {
      await this.bounds.maximize();
    } catch (err) {
      console.warn('Error maximizing window:', err);
    }
  }

  async toggleMaximize(): Promise<void> {
    if (!isTauri()) return;
    try {
      await getCurrentWindow().toggleMaximize();
    } catch (err) {
      console.warn('Error toggling maximize state:', err);
    }
  }

  /** Hides the window into the system tray. */
  async minimizeToTray(): Promise<void> {
    this.showCloseModal.set(false);
    if (!isTauri()) return;
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.warn('Error hiding window to tray:', err);
    }
  }

  /** Minimize button: hides into the system tray. */
  async minimize(): Promise<void> {
    await this.minimizeToTray();
  }

  /**
   * Starts a native window drag from a mouse event, ignoring non-primary buttons and interactive
   * targets. Un-maximizes first, like the native Windows title bar.
   */
  async startDragging(event?: MouseEvent): Promise<void> {
    if (event) {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, select, textarea, [data-no-drag]')) return;
    }
    if (!isTauri()) return;
    try {
      const win = getCurrentWindow();
      if (await win.isMaximized()) await win.unmaximize();
      await win.startDragging();
    } catch (err) {
      console.warn('Error starting Tauri window drag:', err);
    }
  }

  // ──────────────────────────────────────────────
  // Close confirmation
  // ──────────────────────────────────────────────

  private initCloseListener(): void {
    if (!isTauri()) return;
    listen('close-requested', () => this.requestClose()).catch((err) => {
      console.warn('Error setting up close-requested listener:', err);
    });
  }

  requestClose(): void {
    this.showCloseModal.set(true);
  }

  cancelClose(): void {
    this.showCloseModal.set(false);
  }

  close(): void {
    this.requestClose();
  }

  /** Exits the application completely. */
  async confirmExit(): Promise<void> {
    this.showCloseModal.set(false);
    if (!isTauri()) return;
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
