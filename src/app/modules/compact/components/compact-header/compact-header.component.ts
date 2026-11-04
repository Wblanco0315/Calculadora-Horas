import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerSun,
  tablerMoon,
} from '@ng-icons/tabler-icons';
import { WindowService } from '../../../../core/services/window.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { UpdateService } from '../../../../core/services/update.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { AppLogoComponent } from '../../../../shared/components/app-logo/app-logo.component';

@Component({
  selector: 'app-compact-header',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe, AppLogoComponent],
  viewProviders: [
    provideIcons({
      tablerSun,
      tablerMoon,
    }),
  ],
  template: `
    <header
      class="flex z-50 justify-between items-center h-8 bg-slate-50 dark:bg-[#202020] text-slate-800 dark:text-[#ffffff] select-none transition-colors shrink-0 overflow-hidden border-b border-slate-200/80 dark:border-zinc-800"
    >
      <!-- Draggable Area (Icon, App Name & Version) -->
      <div
        data-tauri-drag-region
        (mousedown)="onMouseDown($event)"
        class="flex items-center px-3 gap-2 h-full flex-1 cursor-default"
      >
        <app-logo [variant]="'icon'" [size]="'xs'" class="pointer-events-none drop-shadow-xs" />
        <span class="text-xs font-bold text-slate-700 dark:text-zinc-200 pointer-events-none tracking-tight">
          PocketProject
        </span>
        <span
          class="text-[10px] font-medium text-slate-500 dark:text-zinc-400 pointer-events-none"
        >
          v{{ updateService.currentVersion() }}
        </span>
      </div>

      <!-- Window Controls (Windows Native Style) -->
      <div class="flex h-full items-center">
        <!-- Theme Toggle -->
        <button
          type="button"
          (click)="themeService.toggleTheme()"
          class="inline-flex items-center justify-center w-[46px] h-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300"
          [title]="'compact.theme' | translate"
        >
          <ng-icon
            [name]="themeService.isDark() ? 'tablerSun' : 'tablerMoon'"
            size="0.95rem"
          />
        </button>

        <!-- Native Minimize Button -->
        <button
          type="button"
          (click)="windowService.minimize()"
          class="inline-flex items-center justify-center w-[46px] h-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300"
          [title]="'compact.minimize' | translate"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M 0,5 H 10"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>

        <!-- Native Close Button -->
        <button
          type="button"
          (click)="windowService.close()"
          class="inline-flex items-center justify-center w-[46px] h-full hover:bg-[#E81123] hover:text-white transition-colors cursor-pointer text-slate-600 dark:text-zinc-300"
          [title]="'compact.close' | translate"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M 0,0 L 10,10 M 10,0 L 0,10"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>
      </div>
    </header>
  `,
})
export class CompactHeaderComponent {
  readonly windowService = inject(WindowService);
  readonly themeService = inject(ThemeService);
  readonly updateService = inject(UpdateService);

  onMouseDown(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    this.windowService.startDragging();
  }
}
