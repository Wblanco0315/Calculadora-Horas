import { Injectable, inject, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { FavoriteTicket } from '../interfaces/activity.interface';
import { NotificationService } from './notification.service';
import { LEGACY_STORAGE_KEY } from '../utils/storage-key.util';

const FAVORITES_STORAGE_KEY = 'pocketproject_favorite_tickets';

/** Favorite tickets: SQLite on desktop with a localStorage mirror (and legacy V1 migration). */
@Injectable({ providedIn: 'root' })
export class FavoriteService {
  private readonly notificationService = inject(NotificationService);

  readonly favoriteTickets = signal<FavoriteTicket[]>(this.loadStoredFavorites());

  async loadFavorites(): Promise<void> {
    if (isTauri()) {
      try {
        const rows = await invoke<FavoriteTicket[]>('get_favorite_tickets');
        if (rows && rows.length > 0) {
          this.favoriteTickets.set(rows);
          if (typeof window !== 'undefined') {
            localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(rows));
          }
          return;
        }
      } catch (e) {
        console.warn('Could not load favorites from SQLite:', e);
      }
    }

    const stored = this.loadStoredFavorites();
    if (stored.length > 0) {
      this.favoriteTickets.set(stored);
      if (isTauri()) {
        for (const item of stored) {
          invoke('save_favorite_ticket', { ticket: item }).catch(() => {});
        }
      }
    }
  }

  private loadStoredFavorites(): FavoriteTicket[] {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }

        // Migrate legacy favorite tickets from V1 if available
        const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw);
          if (Array.isArray(legacy.favoriteTickets) && legacy.favoriteTickets.length > 0) {
            const mapped: FavoriteTicket[] = legacy.favoriteTickets
              .map((f: any) => ({
                ticket: String(f.ticket || '').replace(/^#/, '').trim(),
                title: String(f.title || '').trim(),
                projectId: f.projectId ? String(f.projectId) : undefined,
                projectName: f.projectName ? String(f.projectName) : undefined,
              }))
              .filter((f: FavoriteTicket) => !!f.ticket);

            if (mapped.length > 0) {
              localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(mapped));
              return mapped;
            }
          }
        }
      } catch (e) {
        console.warn('Error loading or migrating stored favorites:', e);
      }
    }
    return [];
  }

  private persistFavorites(favs: FavoriteTicket[]): void {
    this.favoriteTickets.set(favs);
    if (typeof window !== 'undefined') {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
    }
  }

  async toggleFavorite(ticket: string, title: string, projectId?: string, projectName?: string): Promise<void> {
    const cleanTicket = ticket.trim().replace(/^#/, '');
    if (!cleanTicket) return;

    const list = [...this.favoriteTickets()];
    const index = list.findIndex((f) => f.ticket === cleanTicket);
    if (index >= 0) {
      list.splice(index, 1);
      if (isTauri()) {
        invoke('delete_favorite_ticket', { ticket: cleanTicket }).catch(() => {});
      }
      this.notificationService.info('toast.favoriteRemoved', { ticket: cleanTicket });
    } else {
      const newFav: FavoriteTicket = { ticket: cleanTicket, title: title.trim(), projectId, projectName };
      list.push(newFav);
      if (isTauri()) {
        invoke('save_favorite_ticket', { ticket: newFav }).catch(() => {});
      }
      this.notificationService.success('toast.favoriteAdded', { ticket: cleanTicket });
    }
    this.persistFavorites(list);
  }

  isFavorite(ticket: string): boolean {
    const cleanTicket = ticket.trim().replace(/^#/, '');
    return this.favoriteTickets().some((f) => f.ticket === cleanTicket);
  }
}
