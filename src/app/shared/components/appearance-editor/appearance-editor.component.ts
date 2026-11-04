import { Component, inject, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerPalette,
  tablerDeviceDesktop,
  tablerSun,
  tablerMoon,
  tablerLanguage,
  tablerColorPicker,
  tablerCheck,
} from '@ng-icons/tabler-icons';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Popover } from 'primeng/popover';
import { ColorPicker } from 'primeng/colorpicker';
import { InputText } from 'primeng/inputtext';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { StorageService } from '../../../core/services/storage.service';
import { AppLanguage, PrimaryColor, ThemeMode } from '../../../core/interfaces/config.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';

export interface ColorOption {
  id: string;
  name: string;
  bgClass: string;
  hex: string;
}

export const PRESET_COLORS: ColorOption[] = [
  { id: 'violet', name: 'Violeta', bgClass: 'bg-violet-600', hex: '#5E4DA2' },
  { id: 'indigo', name: 'Índigo', bgClass: 'bg-indigo-500', hex: '#4F46E5' },
  { id: 'blue', name: 'Azul', bgClass: 'bg-blue-500', hex: '#2563EB' },
  { id: 'emerald', name: 'Esmeralda', bgClass: 'bg-emerald-500', hex: '#059669' },
  { id: 'amber', name: 'Ámbar', bgClass: 'bg-amber-500', hex: '#D97706' },
  { id: 'rose', name: 'Rosa', bgClass: 'bg-rose-500', hex: '#E11D48' },
];

@Component({
  selector: 'app-appearance-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgIcon,
    ButtonDirective,
    Select,
    Popover,
    ColorPicker,
    InputText,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerPalette,
      tablerDeviceDesktop,
      tablerSun,
      tablerMoon,
      tablerLanguage,
      tablerColorPicker,
      tablerCheck,
    }),
  ],
  template: `
    <section class="space-y-4 sm:space-y-6">
      @if (showTitle()) {
        <div class="border-b border-slate-100 dark:border-zinc-800 pb-2.5 sm:pb-3">
          <h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <ng-icon name="tablerPalette" size="1.25rem" class="text-primary-600 dark:text-primary-400" />
            {{ 'setup.appearance.title' | translate }}
          </h2>
        </div>
      }

      <!-- Theme Mode Cards -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2 sm:mb-3">
          {{ 'setup.appearance.colorMode' | translate }}
        </label>
        <div class="grid grid-cols-3 gap-2 sm:gap-3">
          <!-- System -->
          <button
            pButton
            type="button"
            (click)="selectTheme('system')"
            [severity]="themeService.themeMode() === 'system' ? 'primary' : 'secondary'"
            [variant]="themeService.themeMode() === 'system' ? undefined : 'outlined'"
            class="w-full h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 cursor-pointer transition-all"
          >
            <ng-icon name="tablerDeviceDesktop" size="1.25rem" />
            <span class="text-[11px] sm:text-xs font-semibold truncate">{{ 'setup.appearance.system' | translate }}</span>
          </button>

          <!-- Light -->
          <button
            pButton
            type="button"
            (click)="selectTheme('light')"
            [severity]="themeService.themeMode() === 'light' ? 'primary' : 'secondary'"
            [variant]="themeService.themeMode() === 'light' ? undefined : 'outlined'"
            class="w-full h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 cursor-pointer transition-all"
          >
            <ng-icon name="tablerSun" size="1.25rem" class="text-amber-500" />
            <span class="text-[11px] sm:text-xs font-semibold truncate">{{ 'setup.appearance.light' | translate }}</span>
          </button>

          <!-- Dark -->
          <button
            pButton
            type="button"
            (click)="selectTheme('dark')"
            [severity]="themeService.themeMode() === 'dark' ? 'primary' : 'secondary'"
            [variant]="themeService.themeMode() === 'dark' ? undefined : 'outlined'"
            class="w-full h-16 sm:h-20 flex flex-col items-center justify-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 cursor-pointer transition-all"
          >
            <ng-icon name="tablerMoon" size="1.25rem" class="text-primary-400" />
            <span class="text-[11px] sm:text-xs font-semibold truncate">{{ 'setup.appearance.dark' | translate }}</span>
          </button>
        </div>
      </div>

      <!-- Language Selector -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2 sm:mb-3 flex items-center gap-1.5">
          <ng-icon name="tablerLanguage" size="1rem" class="text-primary-600 dark:text-primary-400" />
          {{ 'setup.appearance.language' | translate }}
        </label>
        <p-select 
          [options]="languageService.availableLanguages"
          [ngModel]="languageService.currentLang()"
          (ngModelChange)="selectLanguage($event)"
          optionLabel="name"
          optionValue="id"
          styleClass="w-full"
          appendTo="body"
        >
          <ng-template #selectedItem let-selectedOption>
            @if (selectedOption) {
              <div class="flex items-center gap-2.5">
                <span class="text-lg leading-none">{{ selectedOption.flag }}</span>
                <span class="text-sm font-medium">{{ selectedOption.name }}</span>
              </div>
            }
          </ng-template>
          <ng-template #item let-lang>
            <div class="flex items-center gap-2.5">
              <span class="text-lg leading-none">{{ lang.flag }}</span>
              <span class="text-sm font-medium">{{ lang.name }}</span>
            </div>
          </ng-template>
        </p-select>
      </div>

      <!-- Accent Color Selector (p-select with #footer Popover) -->
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2 sm:mb-3 flex items-center gap-1.5">
          <ng-icon name="tablerPalette" size="1rem" class="text-primary-600 dark:text-primary-400" />
          {{ 'setup.appearance.accentColor' | translate }}
        </label>
        <p-select
          [options]="colorOptions()"
          [ngModel]="themeService.primaryColor()"
          (ngModelChange)="onSelectPreset($event)"
          optionLabel="name"
          optionValue="id"
          styleClass="w-full"
          appendTo="body"
        >
          <!-- Selected item representation -->
          <ng-template #selectedItem let-selectedOption>
            @if (selectedOption) {
              <div class="flex items-center gap-2.5">
                <span
                  class="w-3.5 h-3.5 rounded-full shadow-xs shrink-0 ring-1 ring-black/10 dark:ring-white/20"
                  [ngClass]="selectedOption.bgClass"
                  [style.background-color]="isPreset(selectedOption.id) ? undefined : selectedOption.hex"
                ></span>
                <span class="text-sm font-medium">
                  @if (isPreset(selectedOption.id)) {
                    {{ 'colors.' + selectedOption.id | translate }}
                  } @else {
                    {{ 'setup.appearance.customColor' | translate }}
                    <span class="text-xs font-mono opacity-75">({{ selectedOption.hex }})</span>
                  }
                </span>
              </div>
            }
          </ng-template>

          <!-- Dropdown item representation -->
          <ng-template #item let-col>
            <div class="flex items-center gap-2.5">
              <span
                class="w-3.5 h-3.5 rounded-full shadow-xs shrink-0 ring-1 ring-black/10 dark:ring-white/20"
                [ngClass]="col.bgClass"
                [style.background-color]="isPreset(col.id) ? undefined : col.hex"
              ></span>
              <span class="text-sm font-medium">
                @if (isPreset(col.id)) {
                  {{ 'colors.' + col.id | translate }}
                } @else {
                  {{ 'setup.appearance.customColor' | translate }}
                  <span class="text-xs font-mono opacity-75">({{ col.hex }})</span>
                }
              </span>
            </div>
          </ng-template>

          <!-- Footer Template: "Personalizar" button that opens a Popover with ColorPicker -->
          <ng-template #footer>
            <div
              class="p-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/70"
              (click)="$event.stopPropagation()"
            >
              <button
                pButton
                type="button"
                variant="text"
                severity="secondary"
                (click)="customPopover.toggle($event)"
                class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <ng-icon name="tablerColorPicker" size="1.15rem" class="text-primary-600 dark:text-primary-400" />
                  <span>{{ 'setup.appearance.customColor' | translate }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="w-3 h-3 rounded-full shrink-0 shadow-xs ring-1 ring-black/10 dark:ring-white/20"
                    [style.background-color]="themeService.currentHex()"
                  ></span>
                  <span class="font-mono text-[11px] text-slate-500 dark:text-zinc-400 uppercase px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                    {{ themeService.currentHex() }}
                  </span>
                </div>
              </button>

              <!-- Popover with inline ColorPicker -->
              <p-popover #customPopover [dismissable]="true">
                <div class="flex flex-col items-center gap-3 p-1.5" (click)="$event.stopPropagation()">
                  <p-colorpicker
                    [inline]="true"
                    [(ngModel)]="pickerColor"
                    format="hex"
                    (onChange)="onColorPickerChange($event)"
                  />
                  <div class="flex items-center gap-2 w-full px-1">
                    <span class="text-xs font-mono font-bold text-slate-400">#</span>
                    <input
                      pInputText
                      [ngModel]="rawHexInput()"
                      (ngModelChange)="onHexInput($event)"
                      placeholder="5E4DA2"
                      maxlength="7"
                      class="flex-1 h-8 text-xs font-mono uppercase text-center rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 focus:border-primary-500"
                    />
                  </div>
                </div>
              </p-popover>
            </div>
          </ng-template>
        </p-select>
      </div>

      <!-- Optional Save Button -->
      @if (showSaveButton()) {
        <div class="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          @if (savedNotification()) {
            <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ng-icon name="tablerCheck" size="1rem" />
              {{ 'settings.preferencesSaved' | translate }}
            </span>
          } @else {
            <span></span>
          }

          <button
            pButton
            type="button"
            (click)="savePreferences()"
            [loading]="isSaving()"
            class="flex items-center gap-1.5"
          >
            <ng-icon name="tablerCheck" size="1rem" />
            <span>{{ 'settings.savePreferences' | translate }}</span>
          </button>
        </div>
      }
    </section>
  `,
})
export class AppearanceEditorComponent {
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly storageService = inject(StorageService);

  readonly showTitle = input<boolean>(true);
  readonly showSaveButton = input<boolean>(false);

  readonly isSaving = signal<boolean>(false);
  readonly savedNotification = signal<boolean>(false);

  readonly availableColors: ColorOption[] = PRESET_COLORS;

  isPreset(colorId: string): boolean {
    if (!colorId) return false;
    return this.availableColors.some(
      (c) => c.id.toLowerCase() === colorId.toLowerCase()
    );
  }

  readonly colorOptions = computed<ColorOption[]>(() => {
    const currentColor = this.themeService.primaryColor();
    const currentHex = this.themeService.currentHex();
    const isCurrentPreset = this.isPreset(currentColor);

    if (isCurrentPreset) {
      return this.availableColors;
    }

    const customOption: ColorOption = {
      id: currentColor,
      name: `Personalizado (${currentHex})`,
      bgClass: '',
      hex: currentHex,
    };

    return [...this.availableColors, customOption];
  });

  readonly rawHexInput = computed<string>(() => {
    const hex = this.themeService.currentHex();
    return hex.startsWith('#') ? hex.substring(1) : hex;
  });

  get pickerColor(): string {
    return this.themeService.currentHex();
  }

  set pickerColor(val: string) {
    if (!val) return;
    const hex = val.startsWith('#') ? val : `#${val}`;
    this.themeService.setPrimaryColor(hex);
  }

  selectTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  selectLanguage(lang: AppLanguage): void {
    this.languageService.setLanguage(lang);
  }

  onSelectPreset(presetId: PrimaryColor): void {
    if (presetId) {
      this.themeService.setPrimaryColor(presetId);
    }
  }

  onColorPickerChange(event: { value?: any }): void {
    const val = typeof event.value === 'string' ? event.value : '';
    if (val) {
      const hex = val.startsWith('#') ? val : `#${val}`;
      this.themeService.setPrimaryColor(hex);
    }
  }

  onHexInput(value: string): void {
    if (!value) return;
    const clean = value.replace('#', '').trim();
    if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
      this.themeService.setPrimaryColor(`#${clean}`);
    }
  }

  async savePreferences(): Promise<void> {
    this.isSaving.set(true);
    try {
      const current = this.storageService.config();
      await this.storageService.saveConfig({
        ...current,
        theme_mode: this.themeService.themeMode(),
        primary_color: this.themeService.primaryColor(),
        language: this.languageService.currentLang(),
      });
      this.savedNotification.set(true);
      setTimeout(() => this.savedNotification.set(false), 3000);
    } catch (e) {
      console.error('Error saving appearance preferences:', e);
    } finally {
      this.isSaving.set(false);
    }
  }
}
