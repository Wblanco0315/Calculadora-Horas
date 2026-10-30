import { Injectable, signal, effect, computed } from '@angular/core';
import { updatePrimaryPalette, palette } from '@primeuix/themes';
import { ThemeMode, PrimaryColor } from '../interfaces/config.interface';

const THEME_STORAGE_KEY = 'pocketproject_theme';
const COLOR_STORAGE_KEY = 'pocketproject_color';

export const PRIMARY_PALETTES: Record<string, string> = {
  violet: '#5E4DA2',
  indigo: '#4F46E5',
  blue: '#2563EB',
  emerald: '#059669',
  amber: '#D97706',
  rose: '#E11D48',
};

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly themeMode = signal<ThemeMode>(this.getInitialTheme());
  readonly primaryColor = signal<PrimaryColor>(this.getInitialColor());

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
  }

  toggleTheme(): void {
    const isDark = this.isDark();
    this.setTheme(isDark ? 'light' : 'dark');
  }

  setPrimaryColor(color: PrimaryColor): void {
    this.primaryColor.set(color);
  }

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (stored === 'system' || stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'system';
  }

  resolveHex(color: PrimaryColor): string {
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

  private getInitialColor(): PrimaryColor {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(COLOR_STORAGE_KEY) as PrimaryColor | null;
      if (stored) {
        if (stored in PRIMARY_PALETTES || stored.startsWith('#') || /^[0-9A-Fa-f]{3,8}$/.test(stored)) {
          return stored;
        }
      }
    }
    return 'violet';
  }

  private applyTheme(mode: ThemeMode): void {
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

  private applyPrimaryColor(color: PrimaryColor): void {
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
