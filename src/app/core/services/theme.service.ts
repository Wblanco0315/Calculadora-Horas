import { Injectable, signal, effect, computed } from '@angular/core';
import { updatePrimaryPalette, palette } from '@primeuix/themes';
import { ThemeMode, PrimaryColor } from '../interfaces/config.interface';

export const THEME_STORAGE_KEY = 'pocketproject_theme';
export const COLOR_STORAGE_KEY = 'pocketproject_color';

export const PRIMARY_PALETTES: Record<string, string> = {
  violet: '#5E4DA2',
  indigo: '#4F46E5',
  blue: '#2563EB',
  emerald: '#059669',
  amber: '#D97706',
  rose: '#E11D48',
};

export function resolvePrimaryHex(color?: PrimaryColor | null): string {
  if (!color) return PRIMARY_PALETTES['violet'];
  if (color in PRIMARY_PALETTES) {
    return PRIMARY_PALETTES[color];
  }
  const clean = color.trim();
  if (clean.startsWith('#')) {
    return clean;
  }
  if (/^[0-9A-Fa-f]{3,8}$/.test(clean)) {
    return `#${clean}`;
  }
  return PRIMARY_PALETTES['violet'];
}

export function getInitialStoredTheme(): ThemeMode {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        return stored;
      }
      const rawConfig = localStorage.getItem('pocketproject_config_storage');
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig);
        if (parsed.theme_mode === 'system' || parsed.theme_mode === 'light' || parsed.theme_mode === 'dark') {
          return parsed.theme_mode;
        }
      }
    } catch {}
  }
  return 'system';
}

export function getInitialStoredColor(): PrimaryColor {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(COLOR_STORAGE_KEY) as PrimaryColor | null;
      if (stored) {
        if (stored in PRIMARY_PALETTES || stored.startsWith('#') || /^[0-9A-Fa-f]{3,8}$/.test(stored)) {
          return stored;
        }
      }
      const rawConfig = localStorage.getItem('pocketproject_config_storage');
      if (rawConfig) {
        const parsed = JSON.parse(rawConfig);
        if (parsed.primary_color) {
          const col = parsed.primary_color;
          if (col in PRIMARY_PALETTES || col.startsWith('#') || /^[0-9A-Fa-f]{3,8}$/.test(col)) {
            return col;
          }
        }
      }
    } catch {}
  }
  return 'violet';
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly themeMode = signal<ThemeMode>(getInitialStoredTheme());
  readonly primaryColor = signal<PrimaryColor>(getInitialStoredColor());

  readonly isDark = computed<boolean>(() => {
    const mode = this.themeMode();
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  readonly currentHex = computed<string>(() => {
    return this.resolveHex(this.primaryColor());
  });

  constructor() {
    this.applyTheme(this.themeMode());
    this.applyPrimaryColor(this.primaryColor());

    effect(() => {
      const mode = this.themeMode();
      this.applyTheme(mode);
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      }
    });

    effect(() => {
      const color = this.primaryColor();
      this.applyPrimaryColor(color);
      if (typeof window !== 'undefined') {
        localStorage.setItem(COLOR_STORAGE_KEY, color);
      }
    });

    if (typeof window !== 'undefined') {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.themeMode() === 'system') {
            this.applyTheme('system');
          }
        });
    }
  }

  setTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
    this.applyTheme(mode);
  }

  toggleTheme(): void {
    const isDark = this.isDark();
    this.setTheme(isDark ? 'light' : 'dark');
  }

  setPrimaryColor(color: PrimaryColor, force: boolean = false): void {
    const isSame = this.primaryColor() === color;
    this.primaryColor.set(color);
    if (typeof window !== 'undefined') {
      localStorage.setItem(COLOR_STORAGE_KEY, color);
    }
    // If the signal already had this value, Angular's effect won't re-execute.
    // Explicitly apply the primary color so PrimeNG palette stays updated.
    if (isSame || force) {
      this.applyPrimaryColor(color);
    }
  }

  resolveHex(color: PrimaryColor): string {
    return resolvePrimaryHex(color);
  }

  applyTheme(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    let isDark = false;

    if (mode === 'dark') {
      isDark = true;
    } else if (mode === 'light') {
      isDark = false;
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }
  }

  applyPrimaryColor(color: PrimaryColor): void {
    if (typeof document === 'undefined') return;
    const isPreset = color in PRIMARY_PALETTES;
    document.documentElement.setAttribute('data-color', isPreset ? color : 'custom');
    const hex = this.resolveHex(color);
    try {
      updatePrimaryPalette(palette(hex));
    } catch {
      // In case primeui hasn't initialized yet
    }
  }
}
