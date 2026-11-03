import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerCalendar, tablerClock, tablerCheck } from '@ng-icons/tabler-icons';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { UserCardComponent } from '../../../../shared/components/user-card/user-card.component';
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
  template: `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <!-- 1. User Profile & Account Data -->
      <app-user-card />

      <!-- 2. Work Schedule Management -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5">
        <!-- Section Header -->
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <ng-icon name="tablerCalendar" size="1.2rem" />
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-100">
                {{ 'settings.scheduleSection' | translate }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-zinc-400">
                {{ 'settings.scheduleSectionDesc' | translate }}
              </p>
            </div>
          </div>


        <!-- Reusable Schedule Editor with Lunch Adjustment -->
        <app-schedule-editor [showTitle]="false" [showLunch]="true" />

        <!-- Save Schedule Action Bar -->
        <div class="pt-4 flex flex-col sm:flex-row sm:items-center justify-end">


          <button
            pButton
            type="button"
            (click)="saveSchedule()"
            [disabled]="scheduleService.isSaving() || scheduleService.scheduleGroups().length === 0"
            [loading]="scheduleService.isSaving()"
            class="flex items-center gap-2 self-end sm:self-auto cursor-pointer"
          >
            <ng-icon name="tablerCheck" size="1.1rem" />
            <span>{{ 'settings.saveSchedule' | translate }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
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
