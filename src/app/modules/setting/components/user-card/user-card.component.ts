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
import { StorageService } from '../../../../core/services/storage.service';
import { ScheduleService } from '../../../../core/services/schedule.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

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
  templateUrl: './user-card.component.html',
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
