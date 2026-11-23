import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

export type AppViewMode = 'compact' | 'full';

export const COMPACT_WINDOW_WIDTH = 525;
export const COMPACT_WINDOW_HEIGHT = 800;
export const FULL_WINDOW_WIDTH = 1150;
export const FULL_WINDOW_HEIGHT = 780;

const VIEW_MODE_KEY = 'pocketproject_view_mode';

@Injectable({
  providedIn: 'root',
})
export class WindowService {
  private readonly router = inject(Router);

  readonly viewMode = signal<AppViewMode>(this.getInitialViewMode());
  readonly showCloseModal = signal<boolean>(false);

  constructor() {
    this.initCloseListener();
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
   * Switch to Compact Mode (Original Time Calculator view: 525x800)
   */
  async setCompactMode(): Promise<void> {
    this.viewMode.set('compact');
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_MODE_KEY, 'compact');
    }

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.unmaximize();
        await win.setSize(new LogicalSize(COMPACT_WINDOW_WIDTH, COMPACT_WINDOW_HEIGHT));
        await win.center();
      } catch (err) {
        console.warn('Error adjusting window to compact mode:', err);
      }
    }

    await this.router.navigate(['/compact']);
  }

  /**
   * Switch to Full Mode (Dashboard layout view: ~1150x780)
   */
  async setFullMode(targetUrl: string = '/dashboard/overview'): Promise<void> {
    this.viewMode.set('full');
    if (typeof window !== 'undefined') {
      localStorage.setItem(VIEW_MODE_KEY, 'full');
    }

    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        await win.unmaximize();
        await win.setSize(new LogicalSize(FULL_WINDOW_WIDTH, FULL_WINDOW_HEIGHT));
        await win.center();
      } catch (err) {
        console.warn('Error adjusting window to full mode:', err);
      }
    }

    await this.router.navigateByUrl(targetUrl);
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
