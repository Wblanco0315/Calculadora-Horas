import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTrash } from '@ng-icons/tabler-icons';
import { ActivityService } from '../../../../core/services/activity.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-reset-confirm-modal',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerTrash,
    }),
  ],
  template: `
    <p-dialog
      [visible]="activityService.showResetModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '90vw', maxWidth: '380px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2">
          <div class="size-8 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center">
            <ng-icon name="tablerTrash" size="1.1rem" />
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100">
            {{ 'compact.resetDialogTitle' | translate }}
          </h3>
        </div>
      </ng-template>

      <p class="text-xs text-slate-600 dark:text-zinc-300 py-2 leading-relaxed">
        {{ 'compact.resetDialogMessage' | translate }}
      </p>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="activityService.closeResetModal()"
            class="text-xs"
          >
            {{ 'compact.cancel' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="danger"
            size="small"
            (click)="confirmReset()"
            class="text-xs font-semibold"
          >
            {{ 'compact.confirmReset' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class ResetConfirmModalComponent {
  readonly activityService = inject(ActivityService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.activityService.closeResetModal();
    }
  }

  async confirmReset(): Promise<void> {
    this.activityService.closeResetModal();
    await this.activityService.clearDay(this.activityService.selectedDate());
  }
}
