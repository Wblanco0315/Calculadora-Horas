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
   * Full mode is reserved for future versions; for v1.0.0 keeps compact mode
   */
  async setFullMode(_targetUrl: string = '/compact'): Promise<void> {
    await this.setCompactMode();
  }

  /**
   * Toggle view mode - in v1.0.0 remains in compact mode
   */
  async toggleViewMode(): Promise<void> {
    await this.setCompactMode();
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

  async startDragging(): Promise<void> {
    if (isTauri()) {
      try {
        await getCurrentWindow().startDragging();
      } catch (err) {
        console.warn('Error starting Tauri window drag:', err);
      }
    }
  }
}
