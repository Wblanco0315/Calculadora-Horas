import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Avatar } from 'primeng/avatar';
import { Tag } from 'primeng/tag';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerUser,
  tablerCheck,
  tablerRefresh,
  tablerServer,
  tablerCalendar,
  tablerClock,
  tablerCoffee,
  tablerDeviceDesktop,
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Avatar,
    Tag,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerUser,
      tablerCheck,
      tablerRefresh,
      tablerServer,
      tablerCalendar,
      tablerClock,
      tablerCoffee,
      tablerDeviceDesktop,
    }),
  ],
  template: `
    <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-5">
      <!-- Card Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
        <div class="flex flex-row items-center gap-3">
          <p-avatar
            [label]="userInitials()"
            shape="circle"
            size="xlarge"
          />
          <div class="flex flex-col items-start gap-0.5">
            <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <span>{{ userName() }}</span>
            </h3>
            @if (userLogin()) {
              <span class="text-xs font-semibold text-slate-600 dark:text-zinc-400">{{ userLogin() }}</span>
            }
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          @if (isLoggedIn()) {
            <p-tag [value]="'common.connected' | translate" severity="success" />
            <button
              pButton
              type="button"
              (click)="syncFromOpenProject()"
              [loading]="isSyncing()"
              iconOnly
              rounded
              variant="outlined"
              severity="secondary"
              [title]="'settings.syncOpenProject' | translate"
            >
              <ng-icon name="tablerRefresh" size="1.1rem" [class.animate-spin]="isSyncing()" />
            </button>
          } @else {
            <p-tag [value]="'settings.localMode' | translate" severity="secondary" />
          }
        </div>
      </div>

      <!-- Quick Metrics Summary Pills -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <!-- Working Days -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerCalendar" size="1.15rem" />
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {{ 'dashboard.workingDays' | translate: { days: '' } }}
            </span>
            <span class="text-sm font-bold text-slate-800 dark:text-zinc-100">
              {{ storageService.workingDaysCount() }}
            </span>
          </div>
        </div>

        <!-- Weekly Work Target -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerClock" size="1.15rem" />
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {{ 'dashboard.weeklyGoalMeta' | translate: { hours: '' } }}
            </span>
            <span class="text-sm font-bold font-mono text-slate-800 dark:text-zinc-100">
              {{ scheduleService.formattedWeeklyHours() }}
            </span>
          </div>
        </div>

        <!-- Lunch Break -->
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <ng-icon name="tablerCoffee" size="1.15rem" />
          </div>
          <div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              {{ 'setup.schedule.lunchLabel' | translate }}
            </span>
            <span class="text-sm font-bold text-slate-800 dark:text-zinc-100">
              {{ config().lunch_minutes }} min
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class UserCardComponent {
  readonly storageService = inject(StorageService);
  readonly scheduleService = inject(ScheduleService);
  readonly languageService = inject(LanguageService);

  readonly config = this.storageService.config;
  readonly isLoggedIn = this.storageService.isLoggedIn;

  editableName = this.storageService.userName();
  readonly isSavingName = signal<boolean>(false);
  readonly nameSavedNotification = signal<boolean>(false);
  readonly isSyncing = signal<boolean>(false);

  readonly userName = computed(() => {
    return this.storageService.userName() || this.languageService.t('common.userFallback');
  });

  readonly userLogin = computed(() => {
    return this.config().user_login ? `${this.config().user_login}` : '';
  });

  readonly serverUrl = computed(() => {
    return this.config().openproject_url || this.languageService.t('settings.localMode');
  });

  readonly userInitials = computed(() => {
    const name = this.storageService.userName();
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return 'PP';
  });

  async saveUserName(): Promise<void> {
    const trimmed = this.editableName.trim();
    if (!trimmed) return;
    this.isSavingName.set(true);
    try {
      const current = this.config();
      await this.storageService.saveConfig({
        ...current,
        user_name: trimmed,
      });
      this.nameSavedNotification.set(true);
      setTimeout(() => this.nameSavedNotification.set(false), 3000);
    } catch (e) {
      console.error('Failed to update user name:', e);
    } finally {
      this.isSavingName.set(false);
    }
  }

  async syncFromOpenProject(): Promise<void> {
    this.isSyncing.set(true);
    try {
      await this.storageService.fetchAndSaveUserProfile();
      this.editableName = this.storageService.userName();
    } catch (e) {
      console.error('Failed to sync profile from OpenProject:', e);
    } finally {
      this.isSyncing.set(false);
    }
  }
}
