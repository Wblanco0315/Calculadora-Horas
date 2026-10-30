import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { ProgressBar } from 'primeng/progressbar';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerRefresh,
  tablerSparkles,
  tablerCheck,
  tablerDownload,
  tablerAlertCircle,
  tablerClock,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { UpdateService } from '../../../../core/services/update.service';

@Component({
  selector: 'app-update-section',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    ButtonDirective,
    Tag,
    ProgressBar,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerRefresh,
      tablerSparkles,
      tablerCheck,
      tablerDownload,
      tablerAlertCircle,
      tablerClock,
    }),
  ],
  template: `
    <div class="space-y-4">
      <!-- Section Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0"
          >
            <ng-icon name="tablerSparkles" size="1.2rem" />
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
              {{ 'updater.systemUpdates' | translate }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-zinc-400">
              {{ 'updater.systemUpdatesDesc' | translate }}
            </p>
          </div>
        </div>

        <!-- Current Version Tag -->
        <p-tag
          [value]="'v' + updateService.currentVersion()"
          severity="secondary"
          styleClass="font-mono text-xs px-2.5 py-1 font-semibold"
        />
      </div>

      <!-- Status Banner -->
      @if (updateService.updateAvailable()) {
        <div
          class="p-4 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div class="flex items-start gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 flex items-center justify-center shrink-0 mt-0.5"
            >
              <ng-icon name="tablerDownload" size="1.1rem" />
            </div>
            <div>
              <span class="text-xs sm:text-sm font-bold text-primary-950 dark:text-primary-100 block">
                {{ 'updater.newVersionFound' | translate: { version: updateService.availableVersion() } }}
              </span>
              <span class="text-xs text-primary-700 dark:text-primary-300">
                {{ 'updater.message' | translate: { version: updateService.availableVersion() } }}
              </span>
            </div>
          </div>

          <button
            pButton
            type="button"
            severity="primary"
            size="small"
            (click)="updateService.openModal()"
            class="whitespace-nowrap shrink-0 text-xs font-semibold"
          >
            <ng-icon name="tablerDownload" size="1rem" class="mr-1.5" />
            <span>{{ 'updater.updateNow' | translate }}</span>
          </button>
        </div>
      } @else if (updateService.status() === 'up-to-date') {
        <div
          class="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 flex items-center gap-2.5 text-xs text-slate-700 dark:text-zinc-300"
        >
          <ng-icon name="tablerCheck" class="text-emerald-500" size="1.15rem" />
          <span>{{ 'updater.upToDateDesc' | translate }}</span>
        </div>
      }

      <!-- Downloading Progress in Section -->
      @if (updateService.isDownloading()) {
        <div class="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800">
          <div class="flex justify-between items-center text-xs">
            <span class="font-medium text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <ng-icon name="tablerRefresh" class="animate-spin text-primary-500" size="1rem" />
              {{
                (updateService.downloadProgress() === 100
                  ? 'updater.installing'
                  : 'updater.downloading'
                ) | translate
              }}
            </span>
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400">
              {{ updateService.downloadProgress() }}%
            </span>
          </div>
          <p-progressbar
            [value]="updateService.downloadProgress()"
            [showValue]="false"
            styleClass="h-2 rounded-full overflow-hidden"
          />
        </div>
      }

      <!-- Error Message if any -->
      @if (updateService.errorMessage()) {
        <div
          class="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2"
        >
          <ng-icon name="tablerAlertCircle" size="1.1rem" class="shrink-0" />
          <span>{{ updateService.errorMessage() }}</span>
        </div>
      }

      <!-- Footer Info and Action Button -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div class="flex items-center gap-1.5 text-xs text-slate-400">
          <ng-icon name="tablerClock" size="0.95rem" />
          @if (updateService.lastCheckDate(); as lastCheck) {
            <span>
              {{ 'updater.lastChecked' | translate }}: {{ lastCheck | date: 'shortTime' }}
            </span>
          } @else {
            <span>{{ 'updater.neverChecked' | translate }}</span>
          }
        </div>

        <button
          pButton
          type="button"
          severity="secondary"
          variant="outlined"
          size="small"
          [loading]="updateService.isChecking()"
          [disabled]="updateService.isDownloading()"
          (click)="updateService.checkForUpdates(false)"
          class="text-xs"
        >
          <ng-icon
            name="tablerRefresh"
            size="1rem"
            class="mr-1.5"
            [class.animate-spin]="updateService.isChecking()"
          />
          <span>{{ 'updater.checkButton' | translate }}</span>
        </button>
      </div>
    </div>
  `,
})
export class UpdateSectionComponent {
  readonly updateService = inject(UpdateService);
}
