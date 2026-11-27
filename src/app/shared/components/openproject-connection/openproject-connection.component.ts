import { Component, inject, input, model, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tag } from 'primeng/tag';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputPassword } from 'primeng/inputpassword';
import {
  tablerServer,
  tablerEye,
  tablerEyeOff,
  tablerCheck,
  tablerX,
  tablerHelp,
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { LanguageService } from '../../../core/services/language.service';
import { ConnectionTestResult } from '../../../core/interfaces/config.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TokenGuideModalComponent } from '../token-guide-modal/token-guide-modal.component';

@Component({
  selector: 'app-openproject-connection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Tag,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
    IconField,
    InputIcon,
    InputPassword,
    TokenGuideModalComponent,
  ],
  viewProviders: [
    provideIcons({
      tablerServer,
      tablerEye,
      tablerEyeOff,
      tablerCheck,
      tablerX,
      tablerHelp,
    }),
  ],
  templateUrl: './openproject-connection.component.html',
})
export class OpenprojectConnectionComponent {
  private readonly storageService = inject(StorageService);
  private readonly languageService = inject(LanguageService);

  readonly url = model<string>(this.storageService.config().openproject_url || 'https://openproject.wposs.com/openproject');
  readonly token = model<string>(this.storageService.config().openproject_token || '');
  readonly testResult = model<ConnectionTestResult | null>(null);

  readonly showTitle = input<boolean>(true);
  readonly showSaveButton = input<boolean>(false);
  readonly saved = output<ConnectionTestResult>();

  mask = true;
  readonly showTokenGuide = signal<boolean>(false);
  readonly isTesting = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly savedNotification = signal<boolean>(false);

  async testConnection(): Promise<void> {
    const rawToken = this.token().trim();
    const rawUrl = this.url().trim();

    if (!rawToken) {
      this.testResult.set({
        success: false,
        message: this.languageService.t('setup.openproject.enterTokenError'),
      });
      return;
    }

    this.isTesting.set(true);
    this.testResult.set(null);

    try {
      const res = await this.storageService.testConnection(rawUrl, rawToken);
      this.testResult.set(res);
      this.saved.emit(res);
    } catch (err) {
      this.testResult.set({
        success: false,
        message: this.languageService.t('setup.openproject.testConnectionFailed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      this.isTesting.set(false);
    }
  }

  async saveConnection(): Promise<void> {
    this.isSaving.set(true);
    try {
      const current = this.storageService.config();
      const result = this.testResult();
      const updated = {
        ...current,
        openproject_url: this.url().trim(),
        openproject_token: this.token().trim(),
        user_name: result?.user_name || current.user_name || '',
        user_login: result?.user_login || current.user_login || '',
      };
      await this.storageService.saveConfig(updated);
      this.savedNotification.set(true);
      setTimeout(() => this.savedNotification.set(false), 3000);
    } catch (err) {
      console.error('Failed to save connection:', err);
    } finally {
      this.isSaving.set(false);
    }
  }
}
