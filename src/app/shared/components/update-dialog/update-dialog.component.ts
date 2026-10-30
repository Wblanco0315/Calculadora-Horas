import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { ProgressBar } from 'primeng/progressbar';
import { Tag } from 'primeng/tag';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerDownload,
  tablerSparkles,
  tablerRefresh,
  tablerCheck,
  tablerAlertCircle,
  tablerArrowRight,
} from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { UpdateService } from '../../../core/services/update.service';

@Component({
  selector: 'app-update-dialog',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    ProgressBar,
    Tag,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerDownload,
      tablerSparkles,
      tablerRefresh,
      tablerCheck,
      tablerAlertCircle,
      tablerArrowRight,
    }),
  ],
  template: `
    <p-dialog
      [visible]="updateService.showUpdateModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [closable]="!updateService.isDownloading()"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '480px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center shadow-md shadow-primary-500/20"
          >
            <ng-icon name="tablerSparkles" size="1.25rem" />
          </div>
          <h3 class="text-base font-bold text-slate-900 dark:text-zinc-100">
            {{ 'updater.title' | translate }}
          </h3>
        </div>
      </ng-template>

      <div class="space-y-4 py-2">
        <!-- Version comparison card -->
        <div
          class="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800"
        >
          <div class="flex flex-col">
            <span class="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              {{ 'updater.currentVersion' | translate }}
            </span>
            <span class="text-sm font-bold font-mono text-slate-700 dark:text-zinc-300">
              v{{ updateService.currentVersion() }}
            </span>
          </div>

          <div class="text-slate-400">
            <ng-icon name="tablerArrowRight" size="1.2rem" />
          </div>

          <div class="flex flex-col items-end">
            <span class="text-[11px] font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
              {{ 'updater.title' | translate }}
            </span>
            <p-tag
              [value]="'v' + updateService.availableVersion()"
              severity="success"
              styleClass="font-mono font-bold text-xs"
            />
          </div>
        </div>

        <!-- Description message -->
        <p class="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          {{ 'updater.message' | translate: { version: updateService.availableVersion() } }}
        </p>

        <!-- Release Notes if present -->
        @if (updateService.updateBody()) {
          <div class="space-y-1.5">
            <span class="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              {{ 'updater.releaseNotes' | translate }}
            </span>
            <div
              class="max-h-36 overflow-y-auto p-3 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-700 dark:text-zinc-300 font-sans whitespace-pre-line leading-relaxed"
            >
              {{ updateService.updateBody() }}
            </div>
          </div>
        }

        <!-- Error Alert if any -->
        @if (updateService.errorMessage()) {
          <div
            class="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs"
          >
            <ng-icon name="tablerAlertCircle" size="1.2rem" class="shrink-0 mt-0.5" />
            <div class="flex-1">
              <span class="font-semibold block">{{ 'updater.installError' | translate }}</span>
              <span class="opacity-90">{{ updateService.errorMessage() }}</span>
            </div>
          </div>
        }

        <!-- Downloading progress state -->
        @if (updateService.isDownloading()) {
          <div class="space-y-2 pt-2">
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
      </div>

      <ng-template #footer>
        @if (!updateService.isDownloading()) {
          <div class="flex items-center justify-end gap-2 w-full pt-2">
            <button
              pButton
              type="button"
              severity="secondary"
              variant="text"
              size="small"
              (click)="updateService.dismissModal()"
              class="text-xs sm:text-sm"
            >
              {{ 'updater.later' | translate }}
            </button>
            <button
              pButton
              type="button"
              severity="primary"
              size="small"
              (click)="updateService.installUpdate()"
              class="text-xs sm:text-sm font-semibold"
            >
              <ng-icon name="tablerDownload" size="1.1rem" class="mr-1.5" />
              <span>{{ 'updater.updateNow' | translate }}</span>
            </button>
          </div>
        } @else {
          <div class="w-full text-center py-1">
            <span class="text-xs text-slate-400">
              {{ 'updater.installing' | translate }}
            </span>
          </div>
        }
      </ng-template>
    </p-dialog>
  `,
})
export class UpdateDialogComponent {
  readonly updateService = inject(UpdateService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.updateService.dismissModal();
    }
  }
}
