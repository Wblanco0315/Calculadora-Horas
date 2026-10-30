import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

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

  async minimize(): Promise<void> {
    if (isTauri()) {
      try {
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn('Error minimizing Tauri window:', err);
      }
    }
  }

  async close(): Promise<void> {
    if (isTauri()) {
      try {
        await getCurrentWindow().close();
      } catch (err) {
        console.warn('Error closing Tauri window:', err);
      }
    }
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
