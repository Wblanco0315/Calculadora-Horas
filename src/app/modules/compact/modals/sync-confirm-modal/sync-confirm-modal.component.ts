import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerCloudUpload,
  tablerRefresh,
  tablerCheck,
  tablerAlertCircle,
} from '@ng-icons/tabler-icons';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-sync-confirm-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, ButtonDirective, Select, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerCloudUpload,
      tablerRefresh,
      tablerCheck,
      tablerAlertCircle,
    }),
  ],
  template: `
    <p-dialog
      [visible]="activityService.showSyncModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '420px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2.5">
          <div
            class="size-8 rounded-xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold"
          >
            <ng-icon name="tablerCloudUpload" size="1.2rem" />
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
              {{ 'compact.syncModal.title' | translate }}
            </h3>
            <p class="text-[11px] text-slate-500 dark:text-zinc-400">
              {{ 'compact.syncModal.subtitle' | translate }}
            </p>
          </div>
        </div>
      </ng-template>

      <div class="space-y-3.5 py-1 text-xs">
        @if (singleActivity(); as act) {
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800 space-y-1">
            <span class="font-bold text-slate-800 dark:text-zinc-100 block">
              Ticket #{{ act.ticket }} - {{ act.name }}
            </span>
            <span class="text-slate-500 dark:text-zinc-400">
              {{ 'compact.syncModal.time' | translate }}: {{ act.minutes }} {{ 'compact.syncModal.minutes' | translate }} ({{ (act.minutes / 60).toFixed(2) }}h) · {{ 'compact.syncModal.date' | translate }}: {{ act.date }}
            </span>
          </div>
        } @else {
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-800">
            <span class="font-bold text-slate-800 dark:text-zinc-100 block">
              {{ 'compact.syncModal.bulkCount' | translate: { count: syncCount() } }}
            </span>
            <span class="text-slate-500 dark:text-zinc-400 text-[11px]">
              {{ 'compact.syncModal.bulkDesc' | translate }}
            </span>
          </div>
        }

        <!-- Activity Type Selector (e.g., Desarrollo, Soporte, Gestión) -->
        <div>
          <label class="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
            {{ 'compact.syncModal.activityTypeLabel' | translate }}
          </label>
          <p-select
            [(ngModel)]="selectedActivityTypeId"
            [options]="activityTypeOptions()"
            optionLabel="label"
            optionValue="value"
            [placeholder]="'compact.syncModal.selectTypePlaceholder' | translate"
            styleClass="w-full text-xs"
          />
        </div>

        @if (statusMessage()) {
          <div
            class="p-2.5 rounded-lg text-xs flex items-center gap-2"
            [class.bg-emerald-50]="statusType() === 'success'"
            [class.text-emerald-700]="statusType() === 'success'"
            [class.dark:bg-emerald-950/40]="statusType() === 'success'"
            [class.dark:text-emerald-300]="statusType() === 'success'"
            [class.bg-red-50]="statusType() === 'error'"
            [class.text-red-700]="statusType() === 'error'"
            [class.dark:bg-red-950/40]="statusType() === 'error'"
            [class.dark:text-red-300]="statusType() === 'error'"
          >
            <ng-icon
              [name]="statusType() === 'success' ? 'tablerCheck' : 'tablerAlertCircle'"
              size="1.1rem"
              class="shrink-0"
            />
            <span>{{ statusMessage() }}</span>
          </div>
        }
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            [disabled]="isSubmitting()"
            (click)="activityService.closeSyncModal()"
            class="text-xs"
          >
            {{ 'compact.syncModal.cancel' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="primary"
            size="small"
            [loading]="isSubmitting()"
            (click)="confirmSync()"
            class="text-xs font-semibold"
          >
            {{ 'compact.syncModal.send' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class SyncConfirmModalComponent {
  readonly activityService = inject(ActivityService);
  readonly languageService = inject(LanguageService);

  readonly singleActivity = computed(() => this.activityService.singleSyncActivity());
  readonly isSubmitting = signal<boolean>(false);
  readonly statusMessage = signal<string>('');
  readonly statusType = signal<'success' | 'error'>('success');

  selectedActivityTypeId = '';

  readonly activityTypeOptions = computed(() => {
    return this.activityService.timeEntryActivities().map((t) => ({
      label: t.name,
      value: t.id,
    }));
  });

  readonly syncCount = computed(() => {
    if (this.activityService.isSelectionMode() && this.activityService.selectedActivities().length > 0) {
      return this.activityService.selectedActivities().length;
    }
    return this.activityService.unsyncedActivities().length;
  });

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.activityService.closeSyncModal();
      this.statusMessage.set('');
    }
  }

  async confirmSync(): Promise<void> {
    this.isSubmitting.set(true);
    this.statusMessage.set('');

    const single = this.singleActivity();
    if (single) {
      const res = await this.activityService.syncActivity(single.id, this.selectedActivityTypeId || undefined);
      this.isSubmitting.set(false);
      if (res.ok) {
        this.statusType.set('success');
        this.statusMessage.set(this.languageService.t('compact.syncModal.successSingle'));
        setTimeout(() => {
          this.activityService.closeSyncModal();
        }, 1200);
      } else {
        this.statusType.set('error');
        this.statusMessage.set(res.error || this.languageService.t('compact.syncModal.error'));
      }
    } else {
      const res = await this.activityService.syncAllUnsynced(this.selectedActivityTypeId || undefined);
      this.isSubmitting.set(false);
      if (res.failCount === 0) {
        this.statusType.set('success');
        this.statusMessage.set(this.languageService.t('compact.syncModal.successBulk', { count: res.successCount }));
        setTimeout(() => {
          this.activityService.closeSyncModal();
        }, 1200);
      } else {
        this.statusType.set('error');
        this.statusMessage.set(
          this.languageService.t('compact.syncModal.partialBulk', { success: res.successCount, fail: res.failCount })
        );
      }
    }
  }
}
