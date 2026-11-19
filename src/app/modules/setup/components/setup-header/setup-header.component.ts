import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SetupService } from '../../services/setup.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { WindowService } from '../../../../core/services/window.service';
import { AppLogoComponent } from '../../../../shared/components/app-logo/app-logo.component';

@Component({
  selector: 'app-setup-header',
  standalone: true,
  imports: [CommonModule, NgIcon, TranslatePipe, AppLogoComponent],
  viewProviders: [
    provideIcons({
      tablerX,
    }),
  ],
  template: `
    <header
      (mousedown)="onMouseDown($event)"
      (dblclick)="onDoubleClick($event)"
      class="border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900 select-none cursor-default px-4 py-2 sm:px-6"
    >
      <div class="flex items-center gap-2.5">
        <app-logo [variant]="'icon'" [size]="'sm'" class="pointer-events-none drop-shadow-xs" />
        <h1 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight pointer-events-none">
          {{ (storageService.isConfigured() ? 'compact.settings' : 'setup.title') | translate }}
        </h1>
        @if (!storageService.isConfigured()) {
          <span class="text-xs text-slate-400 dark:text-zinc-500 font-mono font-medium pointer-events-none">
            ({{ setupService.activeStep() }}/4)
          </span>
        }
      </div>

      <!-- Window Action Controls -->
      <div class="flex h-full items-center">
        <!-- Native Minimize Button -->
        <button
          type="button"
          (click)="windowService.minimize()"
          class="inline-flex items-center justify-center w-[36px] h-8 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 rounded-md"
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

        <!-- Native Maximize / Restore Button -->
        <button
          type="button"
          (click)="windowService.toggleMaximize()"
          class="inline-flex items-center justify-center w-[36px] h-8 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 rounded-md"
          [title]="'compact.toggleMaximize' | translate"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="0.5"
              y="0.5"
              width="9"
              height="9"
              stroke="currentColor"
              stroke-width="1"
              fill="none"
            />
          </svg>
        </button>

        <!-- Close Button -->
        @if (storageService.isConfigured()) {
          <button
            type="button"
            (click)="closeSetup()"
            class="inline-flex items-center justify-center w-[36px] h-8 hover:bg-[#E81123] hover:text-white transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 rounded-md"
            [title]="'common.close' | translate"
          >
            <ng-icon name="tablerX" size="1.1rem" />
          </button>
        } @else {
          <button
            type="button"
            (click)="windowService.requestClose()"
            class="inline-flex items-center justify-center w-[36px] h-8 hover:bg-[#E81123] hover:text-white transition-colors cursor-pointer text-slate-600 dark:text-zinc-300 rounded-md"
            [title]="'common.close' | translate"
          >
            <ng-icon name="tablerX" size="1.1rem" />
          </button>
        }
      </div>
    </header>
  `,
})
export class SetupHeaderComponent {
  readonly setupService = inject(SetupService);
  readonly storageService = inject(StorageService);
  readonly themeService = inject(ThemeService);
  readonly windowService = inject(WindowService);

  onMouseDown(event: MouseEvent): void {
    this.windowService.startDragging(event);
  }

  onDoubleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }
    this.windowService.toggleMaximize();
  }

  async closeSetup(): Promise<void> {
    await this.windowService.setCompactMode();
  }
}
