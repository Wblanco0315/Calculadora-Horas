import { Injectable, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { StorageService } from '../storage.service';

/** Base OpenProject API client: instance URL, credentials, auth headers, runtime detection and shared converters. */
@Injectable({ providedIn: 'root' })
export class OpenprojectService {
  private readonly storageService = inject(StorageService);

  isTauriApp(): boolean {
    try {
      return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    } catch {
      return false;
    }
  }

  sanitizeUrl(url?: string): string {
    const raw = (url || this.storageService.config().openproject_url || '').trim();
    let clean = raw.replace(/\/+$/, '');
    if (!clean) {
      clean = 'https://openproject.wposs.com/openproject';
    }
    if (clean.endsWith('/api/v3')) {
      clean = clean.substring(0, clean.length - 7);
    }
    return clean;
  }

  getWorkPackageUrl(ticket: string): string {
    const raw = ticket.trim().replace(/^#/, '');
    return `${this.sanitizeUrl()}/work_packages/${raw}`;
  }

  getToken(): string {
    return (this.storageService.config().openproject_token || '').trim();
  }

  buildAuthHeaders(token: string): Record<string, string> {
    const trimmed = token.trim();
    let auth = '';
    if (trimmed.startsWith('Bearer ') || trimmed.startsWith('opapi-')) {
      auth = trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`;
    } else {
      const encoded = typeof btoa !== 'undefined' ? btoa(`apikey:${trimmed}`) : '';
      auth = `Basic ${encoded}`;
    }

    return {
      Authorization: auth,
      Accept: 'application/hal+json, application/json',
      'Content-Type': 'application/json',
    };
  }

  /**
   * Converts minutes into an ISO 8601 duration string (e.g. 90 -> "PT1.5H", 15 -> "PT0.25H")
   */
  minutesToISO(minutes: number): string {
    const hours = parseFloat((Math.max(0, minutes) / 60).toFixed(2));
    return `PT${hours}H`;
  }

  /**
   * Converts an ISO 8601 duration string (e.g. "PT1H30M", "PT1.5H") to total minutes
   */
  isoDurationToMinutes(iso?: string | null): number {
    if (!iso) return 0;
    const match = iso.match(/P(?:(\d+(?:\.\d+)?)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/i);
    if (!match) return 0;
    const days = parseFloat(match[1] || '0');
    const hours = parseFloat(match[2] || '0');
    const mins = parseFloat(match[3] || '0');
    const secs = parseFloat(match[4] || '0');
    return Math.round(days * 8 * 60 + hours * 60 + mins + secs / 60);
  }

  /**
   * Resolves an OpenProject href (absolute, root-relative or relative) against the configured
   * base URL without duplicating the relative root (e.g. `/openproject/openproject/...`).
   */
  resolveHref(href: string): string {
    const trimmed = href.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const base = this.sanitizeUrl();
    let origin = base;
    let basePath = '';
    try {
      const parsed = new URL(base);
      origin = parsed.origin;
      basePath = parsed.pathname.replace(/\/+$/, '');
    } catch {
      // Keep the raw base when it cannot be parsed
    }
    if (trimmed.startsWith('/')) {
      if (basePath && (trimmed === basePath || trimmed.startsWith(`${basePath}/`))) {
        return `${origin}${trimmed}`;
      }
      return `${base}${trimmed}`;
    }
    return `${base}/${trimmed}`;
  }

  async getCurrentUserId(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;
    const url = this.sanitizeUrl();

    if (this.isTauriApp()) {
      try {
        return await invoke<string>('fetch_current_user_id', { url, token });
      } catch {
        return null;
      }
    }

    try {
      const response = await fetch(`${url}/api/v3/users/me`, {
        headers: this.buildAuthHeaders(token),
      });
      if (!response.ok) return null;
      const user = await response.json();
      return user?.id !== undefined ? String(user.id) : null;
    } catch {
      return null;
    }
  }
}
