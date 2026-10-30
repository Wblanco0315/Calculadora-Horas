import { Component, inject, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerCheck, tablerX } from '@ng-icons/tabler-icons';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { ScheduleEditorComponent } from '../../../../shared/components/schedule-editor/schedule-editor.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-schedule-modal',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    NgIcon,
    ScheduleEditorComponent,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerCalendar,
      tablerCheck,
      tablerX,
    }),
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="onVisibleChange($event)"
      (onShow)="onDialogShow()"
      (onHide)="onDialogHide()"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="true"
      [focusOnShow]="true"
      appendTo="body"
      styleClass="w-full max-w-xl md:max-w-2xl mx-3 rounded-2xl shadow-2xl overflow-hidden"
      [contentStyle]="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
    >
      <ng-template #header>
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
            <ng-icon name="tablerCalendar" size="1.25rem" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-800 dark:text-zinc-100">
              {{ 'dashboard.editScheduleModalTitle' | translate }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400">
              {{ 'setup.schedule.description' | translate }}
            </p>
          </div>
        </div>
      </ng-template>

      <div class="py-1">
        <app-schedule-editor [showTitle]="false" [showLunch]="true" />
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-between w-full pt-3 border-t border-slate-100 dark:border-zinc-800">
          <div class="text-xs text-slate-500 dark:text-zinc-400 font-medium">
            {{ 'setup.schedule.weeklySummary' | translate }}:
            <span class="font-bold text-primary-600 dark:text-primary-400 font-mono text-sm ml-1">
              {{ scheduleService.formattedWeeklyHours() }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <button
              pButton
              type="button"
              (click)="cancel()"
              variant="outlined"
              severity="secondary"
              [disabled]="scheduleService.isSaving()"
            >
              {{ 'common.cancel' | translate }}
            </button>

            <button
              pButton
              type="button"
              (click)="save()"
              [disabled]="scheduleService.scheduleGroups().length === 0"
              [loading]="scheduleService.isSaving()"
            >
              <ng-icon name="tablerCheck" size="1rem" class="mr-1" />
              <span>{{ 'common.save' | translate }}</span>
            </button>
          </div>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ScheduleModalComponent {
  readonly scheduleService = inject(ScheduleService);

  readonly visible = model<boolean>(false);

  onDialogShow(): void {
    this.scheduleService.resetFromCurrentConfig();
  }

  onDialogHide(): void {
    this.scheduleService.resetFromCurrentConfig();
  }

  onVisibleChange(isVisible: boolean): void {
    this.visible.set(isVisible);
    if (!isVisible) {
      this.cancel();
    }
  }

  cancel(): void {
    this.scheduleService.resetFromCurrentConfig();
    this.visible.set(false);
  }

  async save(): Promise<void> {
    if (this.scheduleService.scheduleGroups().length === 0) return;
    try {
      await this.scheduleService.saveSchedule();
      this.visible.set(false);
    } catch (err) {
      console.error('Failed to save schedule from modal:', err);
    }
  }
}
