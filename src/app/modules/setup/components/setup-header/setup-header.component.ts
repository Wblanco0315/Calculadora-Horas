import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SetupService } from '../../services/setup.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { AppLogoComponent } from '../../../../shared/components/app-logo/app-logo.component';

@Component({
  selector: 'app-setup-header',
  standalone: true,
  imports: [CommonModule, ButtonDirective, NgIcon, TranslatePipe, AppLogoComponent],
  viewProviders: [
    provideIcons({
      tablerX,
    }),
  ],
  template: `
    <header
      data-tauri-drag-region
      class="border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900 select-none"
      [ngClass]="storageService.isConfigured() ? 'px-4 py-2.5 sm:px-5 sm:py-3' : 'px-4 sm:px-8 py-3.5 sm:py-4'"
    >
      <div class="flex items-center gap-2.5" data-tauri-drag-region>
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

      @if (storageService.isConfigured()) {
        <button
          pButton
          (click)="closeSetup()"
          iconOnly
          rounded
          severity="secondary"
          [title]="'common.close' | translate"
        >
          <ng-icon name="tablerX" size="1.1rem" />
        </button>
      }
    </header>
  `,
})
export class SetupHeaderComponent {
  readonly setupService = inject(SetupService);
  readonly storageService = inject(StorageService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  closeSetup(): void {
    this.router.navigate(['/compact']);
  }
}
