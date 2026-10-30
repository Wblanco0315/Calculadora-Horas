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
} from '@ng-icons/tabler-icons';
import { StorageService } from '../../../core/services/storage.service';
import { LanguageService } from '../../../core/services/language.service';
import { ConnectionTestResult } from '../../../core/interfaces/config.interface';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
  ],
  viewProviders: [
    provideIcons({
      tablerServer,
      tablerEye,
      tablerEyeOff,
      tablerCheck,
      tablerX,
    }),
  ],
  template: `
    <section class="space-y-4 sm:space-y-6">
      @if (showTitle()) {
        <div class="border-b border-slate-100 dark:border-zinc-800 pb-2.5 sm:pb-3">
          <h2 class="text-sm sm:text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
            <ng-icon name="tablerServer" size="1.25rem" class="text-primary-600 dark:text-primary-400" />
            {{ 'setup.openproject.title' | translate }}
          </h2>
          <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            {{ 'setup.openproject.description' | translate }}
          </p>
        </div>
      }

      <!-- OpenProject URL -->
      <div>
        <label for="openproject-url" class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
          {{ 'setup.openproject.serverUrl' | translate }}
        </label>
        <input
          id="openproject-url"
          type="url"
          placeholder="https://openproject.wposs.com/openproject"
          [ngModel]="url()"
          (ngModelChange)="url.set($event)"
          class="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-100 font-medium transition-all text-xs sm:text-sm focus:outline-hidden focus:border-primary-500"
        />
      </div>

      <!-- OpenProject Token -->
      <div>
        <label for="openproject-token" class="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
          {{ 'setup.openproject.personalToken' | translate }}
        </label>
        <p-iconfield class="w-full block">
          <input
            id="openproject-token"
            pInputPassword
            [(mask)]="mask"
            [placeholder]="'setup.openproject.tokenPlaceholder' | translate"
            [ngModel]="token()"
            (ngModelChange)="token.set($event)"
            class="w-full px-3.5 sm:px-4 py-2 sm:py-2.5 pr-12 bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-100 font-mono text-xs sm:text-sm transition-all focus:outline-hidden focus:border-primary-500"
          />
          <p-inputicon
            (click)="mask = !mask"
            style="cursor: pointer"
            [title]="(mask ? 'setup.openproject.showToken' : 'setup.openproject.hideToken') | translate"
          >
            @if (mask) {
              <ng-icon name="tablerEyeOff" size="1.1rem" />
            } @else {
              <ng-icon name="tablerEye" size="1.1rem" />
            }
          </p-inputicon>
        </p-iconfield>
      </div>

      <!-- Test Connection Button & Result -->
      <div class="space-y-3">
        <button
          pButton
          type="button"
          (click)="testConnection()"
          [disabled]="isTesting() || !token().trim()"
          [loading]="isTesting()"
          variant="outlined"
          severity="secondary"
          class="w-full flex items-center justify-center cursor-pointer"
        >
          <ng-icon name="tablerCheck" class="mr-1.5" />
          <span>{{ 'setup.openproject.testButton' | translate }}</span>
        </button>

        <!-- Result Message -->
        @if (testResult(); as res) {
          @if (res.success) {
            <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 animate-fadeIn">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                  <ng-icon name="tablerCheck" size="1.25rem" strokeWidth="2.5" />
                </div>
                <div>
                  <div class="text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-100">
                    {{ res.message }}
                  </div>
                  @if (res.user_login) {
                    <div class="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300">
                      {{ res.user_name }} (&#64;{{ res.user_login }})
                    </div>
                  }
                </div>
              </div>
              <p-tag [value]="'common.connected' | translate" severity="success" styleClass="self-start sm:self-auto" />
            </div>
          } @else {
            <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start sm:items-center gap-3 animate-fadeIn">
              <div class="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                <ng-icon name="tablerX" size="1.25rem" strokeWidth="2.5" />
              </div>
              <div>
                <div class="text-xs sm:text-sm font-bold text-rose-900 dark:text-rose-100">
                  {{ 'setup.openproject.connectionError' | translate }}
                </div>
                <div class="text-[11px] sm:text-xs text-rose-700 dark:text-rose-300">
                  {{ res.message }}
                </div>
              </div>
            </div>
          }
        }
      </div>

      <!-- Optional Save Connection Button -->
      @if (showSaveButton()) {
        <div class="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          @if (savedNotification()) {
            <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ng-icon name="tablerCheck" size="1rem" />
              {{ 'settings.connectionSaved' | translate }}
            </span>
          } @else {
            <span></span>
          }

          <button
            pButton
            type="button"
            (click)="saveConnection()"
            [loading]="isSaving()"
            class="flex items-center gap-1.5"
          >
            <ng-icon name="tablerCheck" size="1rem" />
            <span>{{ 'settings.saveConnection' | translate }}</span>
          </button>
        </div>
      }
    </section>
  `,
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
