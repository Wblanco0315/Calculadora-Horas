import { Injectable, signal, computed, inject } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { check, Update, DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';

@Injectable({
  providedIn: 'root',
})
export class UpdateService {
  readonly isChecking = signal<boolean>(false);
  readonly updateAvailable = signal<boolean>(false);
  readonly currentVersion = signal<string>('0.5.0');
  readonly availableVersion = signal<string>('');
  readonly updateBody = signal<string>('');
  readonly updateDate = signal<string>('');
  readonly isDownloading = signal<boolean>(false);
  readonly downloadProgress = signal<number>(0);
  readonly showUpdateModal = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly lastCheckDate = signal<Date | null>(null);
  readonly status = signal<UpdateStatus>('idle');

  private pendingUpdate: Update | null = null;

  constructor() {
    this.initVersion();
  }

  private async initVersion(): Promise<void> {
    if (isTauri()) {
      try {
        const ver = await getVersion();
        if (ver) {
          this.currentVersion.set(ver);
        }
      } catch (err) {
        console.warn('Error fetching Tauri app version:', err);
      }
    }
  }

  /**
   * Check for updates from GitHub releases endpoint configured in tauri.conf.json
   * @param silent If true, modal will not be forced open if no update is found
   */
  async checkForUpdates(silent: boolean = false): Promise<boolean> {
    if (this.isChecking() || this.isDownloading()) {
      return false;
    }

    this.isChecking.set(true);
    this.status.set('checking');
    this.errorMessage.set(null);

    if (!isTauri()) {
      console.info('Tauri updater: Running in web browser environment. Updates are only available in desktop app.');
      this.isChecking.set(false);
      this.status.set('up-to-date');
      this.lastCheckDate.set(new Date());
      return false;
    }

    try {
      const update = await check();
      this.lastCheckDate.set(new Date());

      if (update) {
        this.pendingUpdate = update;
        this.updateAvailable.set(true);
        this.availableVersion.set(update.version);
        this.updateBody.set(update.body || '');
        this.updateDate.set(update.date || '');
        this.status.set('available');
        this.showUpdateModal.set(true);
        return true;
      } else {
        if (this.pendingUpdate) {
          try {
            await this.pendingUpdate.close();
          } catch {
            // Ignore close error
          }
          this.pendingUpdate = null;
        }
        this.updateAvailable.set(false);
        this.status.set('up-to-date');
        return false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to check for updates:', err);
      this.errorMessage.set(message);
      this.status.set('error');
      return false;
    } finally {
      this.isChecking.set(false);
    }
  }

  /**
   * Download and install the pending update
   */
  async installUpdate(): Promise<void> {
    if (!this.pendingUpdate || this.isDownloading()) {
      return;
    }

    this.isDownloading.set(true);
    this.status.set('downloading');
    this.downloadProgress.set(0);
    this.errorMessage.set(null);

    let contentLength = 0;
    let downloaded = 0;

    try {
      await this.pendingUpdate.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            this.downloadProgress.set(0);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
              this.downloadProgress.set(pct);
            }
            break;
          case 'Finished':
            this.downloadProgress.set(100);
            this.status.set('installing');
            break;
        }
      });

      // On Windows downloadAndInstall exits or relaunches, but relaunch ensures app restarts
      await relaunch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to download/install update:', err);
      this.errorMessage.set(message);
      this.status.set('error');
      this.isDownloading.set(false);
    }
  }

  dismissModal(): void {
    if (!this.isDownloading()) {
      this.showUpdateModal.set(false);
    }
  }

  openModal(): void {
    if (this.updateAvailable()) {
      this.showUpdateModal.set(true);
    }
  }
}
