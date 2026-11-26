import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerMinimize, tablerPower } from '@ng-icons/tabler-icons';
import { WindowService } from '../../../../core/services/window.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-close-confirm-modal',
  standalone: true,
  imports: [CommonModule, Dialog, ButtonDirective, NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({
      tablerAlertTriangle,
      tablerMinimize,
      tablerPower,
    }),
  ],
  template: `
    <p-dialog
      [visible]="windowService.showCloseModal()"
      (visibleChange)="onVisibleChange($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: '92vw', maxWidth: '420px' }"
      styleClass="p-dialog-rounded"
    >
      <ng-template #header>
        <div class="flex items-center gap-2.5">
          <div class="size-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerAlertTriangle" size="1.15rem" />
          </div>
          <h3 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
            {{ 'compact.closeConfirmModal.title' | translate }}
          </h3>
        </div>
      </ng-template>

      <div class="py-2">
        <p class="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
          {{ 'compact.closeConfirmModal.message' | translate }}
        </p>
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button
            pButton
            type="button"
            severity="secondary"
            variant="text"
            size="small"
            (click)="windowService.cancelClose()"
            class="text-xs"
          >
            {{ 'common.cancel' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="secondary"
            variant="outlined"
            size="small"
            (click)="windowService.minimizeToTray()"
            class="text-xs font-semibold"
          >
            <ng-icon name="tablerMinimize" size="0.95rem" class="mr-1" />
            {{ 'compact.closeConfirmModal.minimizeToTray' | translate }}
          </button>
          <button
            pButton
            type="button"
            severity="danger"
            size="small"
            (click)="windowService.confirmExit()"
            class="text-xs font-semibold"
          >
            <ng-icon name="tablerPower" size="0.95rem" class="mr-1" />
            {{ 'compact.closeConfirmModal.confirmExit' | translate }}
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class CloseConfirmModalComponent {
  readonly windowService = inject(WindowService);

  onVisibleChange(visible: boolean): void {
    if (!visible) {
      this.windowService.cancelClose();
    }
  }
}

