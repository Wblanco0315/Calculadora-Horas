import { Injectable, signal, computed, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  AppConfig,
  ConnectionTestResult,
  DEFAULT_APP_CONFIG,
  DEFAULT_WORK_SCHEDULE,
  calculateWorkMinutes,
  DaySchedule,
  DayOfWeek,
  WorkScheduleConfig,
} from '../interfaces/config.interface';
import { ThemeService, COLOR_STORAGE_KEY, THEME_STORAGE_KEY } from './theme.service';
import { LanguageService } from './language.service';

const CONFIG_STORAGE_KEY = 'pocketproject_config_storage';
const LEGACY_STORAGE_KEY = 'calculadora_horas_data';
const LEGACY_THEME_KEY = 'calculadora_horas_theme';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly themeService = inject(ThemeService);
  private readonly languageService = inject(LanguageService);

  readonly config = signal<AppConfig>(this.getInitialConfig());
  readonly isLoaded = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly isConfigured = computed<boolean>(() => this.config().is_configured);

  readonly userName = computed<string>(() => {
    return this.config().user_name || this.config().user_login || '';
  });

  readonly isLoggedIn = computed<boolean>(() => {
    return !!this.config().openproject_token?.trim();
  });

  private loadPromise: Promise<AppConfig> | null = null;

  constructor() {
    // Immediately hydrate theme & language from initial localStorage config
    const initial = this.config();
    if (initial.theme_mode) {
      this.themeService.setTheme(initial.theme_mode);
    }
    if (initial.primary_color) {
      this.themeService.setPrimaryColor(initial.primary_color);
    }
    if (initial.language) {
      this.languageService.setLanguage(initial.language);
    }

    // Load from SQLite database at the earliest moment
    this.loadConfig().catch((err) => {
      console.warn('Initial SQLite load warning (using local cached config):', err);
    });
  }

  /**
   * Returns today's DayOfWeek (1 = Monday ... 7 = Sunday)
   */
  readonly currentDayOfWeek = computed<DayOfWeek>(() => {
    const jsDay = new Date().getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    return (jsDay === 0 ? 7 : jsDay) as DayOfWeek;
  });

  /**
   * Schedule object for today
   */
  readonly todaySchedule = computed<DaySchedule | undefined>(() => {
    const sched = this.config().schedule || DEFAULT_WORK_SCHEDULE;
    const currentDay = this.currentDayOfWeek();
    return sched.days.find((d) => d.day === currentDay);
  });

  /**
   * Today's expected work target in minutes (0 if it's a day off)
   */
  readonly maxDailyMinutes = computed<number>(() => {
    const today = this.todaySchedule();
    if (today) {
      if (!today.enabled) return 0;
      return calculateWorkMinutes(today.entry_time, today.exit_time, today.lunch_minutes);
    }

    const current = this.config();
    if (!current.entry_time || !current.exit_time) {
      return 480;
    }
    return calculateWorkMinutes(current.entry_time, current.exit_time, current.lunch_minutes);
  });

  /**
   * Weekly total target in minutes across all active days
   */
  readonly weeklyTotalMinutes = computed<number>(() => {
    const sched = this.config().schedule || DEFAULT_WORK_SCHEDULE;
    return sched.days
      .filter((d) => d.enabled)
      .reduce((sum, d) => sum + calculateWorkMinutes(d.entry_time, d.exit_time, d.lunch_minutes), 0);
  });

  /**
   * Count of working days per week
   */
  readonly workingDaysCount = computed<number>(() => {
    const sched = this.config().schedule || DEFAULT_WORK_SCHEDULE;
    return sched.days.filter((d) => d.enabled).length;
  });

  private isTauriApp(): boolean {
    try {
      return isTauri() || (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window);
    } catch {
      return false;
    }
  }

  /**
   * Attempts to parse and migrate legacy V1 (Vue) storage if present
   */
  private getMigratedLegacyConfig(): AppConfig | null {
    if (typeof window === 'undefined') return null;

    try {
      const rawLegacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!rawLegacy) return null;

      const legacy = JSON.parse(rawLegacy);
      const userConfig = legacy.userConfig;
      const openprojectToken = userConfig?.openProjectToken?.trim() || '';

      if (!openprojectToken && !userConfig?.isConfigured) {
        return null;
      }

      const entryTime = userConfig?.entryTime || '08:00';
      const exitTime = userConfig?.exitTime || '17:00';
      const lunchMinutes = typeof userConfig?.lunchMinutes === 'number' ? userConfig.lunchMinutes : 60;

      const days: DaySchedule[] = [
        { day: 1, name: 'Lunes', short_name: 'Lun', enabled: true, entry_time: entryTime, exit_time: exitTime, lunch_minutes: lunchMinutes },
        { day: 2, name: 'Martes', short_name: 'Mar', enabled: true, entry_time: entryTime, exit_time: exitTime, lunch_minutes: lunchMinutes },
        { day: 3, name: 'Miércoles', short_name: 'Mié', enabled: true, entry_time: entryTime, exit_time: exitTime, lunch_minutes: lunchMinutes },
        { day: 4, name: 'Jueves', short_name: 'Jue', enabled: true, entry_time: entryTime, exit_time: exitTime, lunch_minutes: lunchMinutes },
        { day: 5, name: 'Viernes', short_name: 'Vie', enabled: true, entry_time: entryTime, exit_time: exitTime, lunch_minutes: lunchMinutes },
        { day: 6, name: 'Sábado', short_name: 'Sáb', enabled: false, entry_time: '08:00', exit_time: '12:00', lunch_minutes: 0 },
        { day: 7, name: 'Domingo', short_name: 'Dom', enabled: false, entry_time: '08:00', exit_time: '12:00', lunch_minutes: 0 },
      ];

      const schedule: WorkScheduleConfig = {
        mode: 'group',
        groups: [
          {
            id: 'legacy-mon-fri',
            name: 'Lunes a Viernes',
            days: [1, 2, 3, 4, 5],
            entry_time: entryTime,
            exit_time: exitTime,
            lunch_minutes: lunchMinutes,
          },
        ],
        days,
      };

      const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY);
      const themeMode = legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : 'system';

      return {
        ...DEFAULT_APP_CONFIG,
        openproject_url: userConfig?.openProjectUrl || DEFAULT_APP_CONFIG.openproject_url,
        openproject_token: openprojectToken,
        entry_time: entryTime,
        exit_time: exitTime,
        lunch_minutes: lunchMinutes,
        theme_mode: themeMode,
        is_configured: true,
        schedule,
        schedule_json: JSON.stringify(schedule),
      };
    } catch (e) {
      console.warn('Error migrating legacy config from localStorage:', e);
      return null;
    }
  }

  private getInitialConfig(): AppConfig {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AppConfig;
          if (parsed.schedule_json && !parsed.schedule) {
            parsed.schedule = JSON.parse(parsed.schedule_json);
          }
          if (parsed.is_configured && parsed.openproject_token) {
            return {
              ...DEFAULT_APP_CONFIG,
              ...parsed,
            };
          }
        }

        // Fallback: check legacy config from V1
        const legacyMigrated = this.getMigratedLegacyConfig();
        if (legacyMigrated) {
          return legacyMigrated;
        }
      } catch (e) {
        console.warn('Could not parse localStorage config:', e);
      }
    }
    return { ...DEFAULT_APP_CONFIG };
  }

  /**
   * Fast check in SQLite / localStorage to see if user has already configured the app
   */
  async checkIsConfigured(): Promise<boolean> {
    if (this.isTauriApp()) {
      try {
        const configured = await invoke<boolean>('check_is_configured');
        return configured;
      } catch (e) {
        console.warn('Error invoking check_is_configured from Tauri:', e);
      }
    }
    const conf = await this.loadConfig();
    return !!conf.is_configured;
  }

  loadConfig(): Promise<AppConfig> {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.isLoading.set(true);
    this.loadPromise = this.performLoadConfig().finally(() => {
      this.loadPromise = null;
      setTimeout(() => {
        this.isLoading.set(false);
      }, 350);
    });
    return this.loadPromise;
  }

  async reloadConfig(): Promise<AppConfig> {
    this.isLoading.set(true);
    const result = await this.performLoadConfig();
    setTimeout(() => {
      this.isLoading.set(false);
    }, 400);
    return result;
  }

  private async performLoadConfig(): Promise<AppConfig> {
    try {
      let loaded: AppConfig | null = null;

      if (this.isTauriApp()) {
        loaded = await invoke<AppConfig | null>('get_app_config');
      }

      if (loaded && loaded.is_configured && loaded.openproject_token) {
        // Parse schedule_json if present
        if (loaded.schedule_json && !loaded.schedule) {
          try {
            loaded.schedule = JSON.parse(loaded.schedule_json);
          } catch {
            loaded.schedule = DEFAULT_WORK_SCHEDULE;
          }
        } else if (!loaded.schedule) {
          loaded.schedule = DEFAULT_WORK_SCHEDULE;
        }

        const completeConfig: AppConfig = {
          ...DEFAULT_APP_CONFIG,
          ...loaded,
        };

        // Cache loaded SQLite config in localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(completeConfig));
          if (completeConfig.primary_color) {
            localStorage.setItem(COLOR_STORAGE_KEY, completeConfig.primary_color);
          }
          if (completeConfig.theme_mode) {
            localStorage.setItem(THEME_STORAGE_KEY, completeConfig.theme_mode);
          }
        }

        this.config.set(completeConfig);
        this.isLoaded.set(true);

        // Apply theme and language loaded from database
        this.themeService.setTheme(completeConfig.theme_mode);
        this.themeService.setPrimaryColor(completeConfig.primary_color);
        this.languageService.setLanguage(completeConfig.language);

        // Fetch user profile in background if token exists but user_name is missing
        if (completeConfig.openproject_token && !completeConfig.user_name) {
          this.fetchAndSaveUserProfile(completeConfig.openproject_url, completeConfig.openproject_token).catch(() => {});
        }

        return completeConfig;
      }

      // If SQLite is empty or unconfigured, check for legacy v1 data
      const legacyMigrated = this.getMigratedLegacyConfig();
      if (legacyMigrated) {
        console.info('Migrating legacy v1 user configuration to SQLite...');
        await this.saveConfig(legacyMigrated);
        if (legacyMigrated.openproject_token && !legacyMigrated.user_name) {
          this.fetchAndSaveUserProfile(legacyMigrated.openproject_url, legacyMigrated.openproject_token).catch(() => {});
        }
        return legacyMigrated;
      }
    } catch (err) {
      console.error('Error loading config from backend SQLite:', err);
    }

    // If SQLite is empty (first time opening the app), check localStorage
    const cached = this.getInitialConfig();
    this.config.set(cached);
    this.isLoaded.set(true);

    if (cached.openproject_token && !cached.user_name) {
      this.fetchAndSaveUserProfile(cached.openproject_url, cached.openproject_token).catch(() => {});
    }

    return cached;
  }

  async saveConfig(newConfig: AppConfig): Promise<void> {
    const configWithJson: AppConfig = {
      ...newConfig,
      is_configured: true,
      schedule_json: newConfig.schedule ? JSON.stringify(newConfig.schedule) : undefined,
    };

    // 1. Always save immediately to localStorage for instant startup retrieval
    if (typeof window !== 'undefined') {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(configWithJson));
      if (configWithJson.primary_color) {
        localStorage.setItem(COLOR_STORAGE_KEY, configWithJson.primary_color);
      }
      if (configWithJson.theme_mode) {
        localStorage.setItem(THEME_STORAGE_KEY, configWithJson.theme_mode);
      }
    }

    // 2. Save persistently to SQLite database if in Tauri
    if (this.isTauriApp()) {
      try {
        await invoke('save_app_config', { config: configWithJson });
      } catch (err) {
        console.error('Error saving config to backend SQLite:', err);
        throw err;
      }
    }

    this.config.set(configWithJson);
    this.isLoaded.set(true);
    this.themeService.setTheme(configWithJson.theme_mode);
    this.themeService.setPrimaryColor(configWithJson.primary_color);
    this.languageService.setLanguage(configWithJson.language);
  }

  async testConnection(url: string, token: string): Promise<ConnectionTestResult> {
    if (this.isTauriApp()) {
      return await invoke<ConnectionTestResult>('test_openproject_connection', {
        url,
        token,
      });
    }

    // Web Fallback implementation
    const cleanUrl = url.trim().replace(/\/+$/, '').replace(/\/api\/v3$/, '');
    const endpoint = `${cleanUrl}/api/v3/users/me`;
    try {
      const trimmed = token.trim();
      const authHeader = trimmed.startsWith('Bearer ') || trimmed.startsWith('opapi-')
        ? (trimmed.startsWith('Bearer ') ? trimmed : `Bearer ${trimmed}`)
        : `Basic ${btoa(`apikey:${trimmed}`)}`;
      const res = await fetch(endpoint, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          user_name: data.name,
          user_login: data.login,
          message: `¡Conexión exitosa! Bienvenido/a ${data.name || 'Usuario'}.`,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          message: 'Token inválido o permisos insuficientes (401/403).',
        };
      }

      return {
        success: false,
        message: `El servidor respondió con código HTTP ${res.status}`,
      };
    } catch (err) {
      return {
        success: false,
        message: `Error de conexión: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async fetchAndSaveUserProfile(url?: string, token?: string): Promise<void> {
    const targetUrl = (url || this.config().openproject_url || '').trim();
    const targetToken = (token || this.config().openproject_token || '').trim();
    if (!targetToken) return;

    try {
      const res = await this.testConnection(targetUrl, targetToken);
      if (res.success && res.user_name) {
        const current = this.config();
        if (current.user_name !== res.user_name || current.user_login !== res.user_login) {
          const updated: AppConfig = {
            ...current,
            user_name: res.user_name,
            user_login: res.user_login || current.user_login,
          };
          await this.saveConfig(updated);
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch user profile:', e);
    }
  }
}
