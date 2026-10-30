import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerX } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { SetupService } from '../../services/setup.service';
import { StorageService } from '../../../../core/services/storage.service';

@Component({
  selector: 'app-setup-header',
  standalone: true,
  imports: [CommonModule, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerX,
    }),
  ],
  template: `
    <header class="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-900">
      <div class="flex items-center gap-2.5">
        <h1 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
          {{ 'setup.title' | translate }}
        </h1>
        <span class="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/50">
          {{ setupService.activeStep() }}/4
        </span>
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
  private readonly router = inject(Router);

  closeSetup(): void {
    this.router.navigate(['/dashboard']);
  }
}
