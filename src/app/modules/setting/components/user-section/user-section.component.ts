import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerClock, tablerCheck } from '@ng-icons/tabler-icons';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { UserCardComponent } from '../user-card/user-card.component';
import { ScheduleEditorComponent } from '../../../../shared/components/schedule-editor/schedule-editor.component';

@Component({
  selector: 'app-user-section',
  standalone: true,
  imports: [
    CommonModule,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
    UserCardComponent,
    ScheduleEditorComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerCalendar,
      tablerClock,
      tablerCheck,
    }),
  ],
  templateUrl: './user-section.component.html',
})
export class UserSectionComponent {
  readonly scheduleService = inject(ScheduleService);
  readonly scheduleSavedNotification = signal<boolean>(false);

  async saveSchedule(): Promise<void> {
    if (this.scheduleService.scheduleGroups().length === 0) return;
    try {
      await this.scheduleService.saveSchedule();
      this.scheduleSavedNotification.set(true);
      setTimeout(() => this.scheduleSavedNotification.set(false), 3000);
    } catch (err) {
      console.error('Failed to save schedule from user section:', err);
    }
  }
}
