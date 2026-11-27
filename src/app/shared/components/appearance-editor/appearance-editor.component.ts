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
  { id: 'indigo', name: 'Índigo', bgClass: 'bg-indigo-500', hex: '#6366F1' },
  { id: 'violet', name: 'Violeta', bgClass: 'bg-violet-600', hex: '#5E4DA2' },
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
  templateUrl: './appearance-editor.component.html',
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
        light_style: this.themeService.lightStyle(),
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
