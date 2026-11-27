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
  templateUrl: './schedule-modal.component.html',
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
