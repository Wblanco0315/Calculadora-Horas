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
  templateUrl: './reset-confirm-modal.component.html',
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
