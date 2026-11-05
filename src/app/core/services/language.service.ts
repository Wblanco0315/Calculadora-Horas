import { Injectable, signal, computed } from '@angular/core';
import { AppLanguage } from '../interfaces/config.interface';
import { es } from '../../shared/lang/es';
import { en } from '../../shared/lang/en';

const LANG_STORAGE_KEY = 'pocketproject_lang';

export interface LanguageOption {
  id: AppLanguage;
  name: string;
  flag: string;
}

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  readonly currentLang = signal<AppLanguage>(this.getInitialLanguage());

  readonly availableLanguages: LanguageOption[] = [
    { id: 'es', name: 'Español', flag: '🇪🇸' },
    { id: 'en', name: 'English', flag: '🇺🇸' },
  ];

  private readonly dictionaries = {
    es,
    en,
  };

  readonly currentDictionary = computed(() => {
    return this.dictionaries[this.currentLang()] || this.dictionaries.es;
  });

  setLanguage(lang: AppLanguage): void {
    if (this.currentLang() !== lang) {
      this.currentLang.set(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(LANG_STORAGE_KEY, lang);
      }
    }
  }

  t(path: string, params?: Record<string, string | number>): string {
    const dict = this.currentDictionary();
    const segments = path.split('.');
    let current: any = dict;

    for (const seg of segments) {
      if (current && typeof current === 'object' && seg in current) {
        current = current[seg];
      } else {
        // Fallback to Spanish if key not found in current dictionary
        let fallback: any = this.dictionaries.es;
        for (const fSeg of segments) {
          if (fallback && typeof fallback === 'object' && fSeg in fallback) {
            fallback = fallback[fSeg];
          } else {
            return path; // Key path fallback
          }
        }
        current = fallback;
        break;
      }
    }

    if (typeof current !== 'string') {
      return path;
    }

    if (params) {
      let result = current;
      for (const [key, val] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
      }
      return result;
    }

    return current;
  }

  private getInitialLanguage(): AppLanguage {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LANG_STORAGE_KEY) as AppLanguage | null;
      if (stored === 'es' || stored === 'en') {
        return stored;
      }
      // Infer from browser language if none saved
      const browserLang = navigator.language.toLowerCase();
      if (browserLang.startsWith('en')) {
        return 'en';
      }
    }
    return 'es';
  }
}
