import { Component, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerKey, tablerCheck } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-token-guide-modal',
  standalone: true,
  imports: [
    CommonModule,
    Dialog,
    ButtonDirective,
    NgIcon,
    TranslatePipe,
  ],
  viewProviders: [
    provideIcons({
      tablerKey,
      tablerCheck,
    }),
  ],
  template: `
    <p-dialog
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [resizable]="false"
      [closable]="true"
      [focusOnShow]="true"
      appendTo="body"
      styleClass="w-full max-w-md mx-3 rounded-2xl shadow-2xl overflow-hidden"
      [contentStyle]="{ 'max-height': '80vh', 'overflow-y': 'auto' }"
    >
      <ng-template #header>
        <div class="flex items-center gap-2">
          <ng-icon name="tablerKey" size="1.25rem" class="text-primary-600 dark:text-primary-400 shrink-0" />
          <span class="text-base font-bold text-slate-800 dark:text-zinc-100">
            {{ 'setup.openproject.tokenGuideTitle' | translate }}
          </span>
        </div>
      </ng-template>

      <div class="py-2">
        <ol class="space-y-3.5">
          <li class="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 shrink-0 select-none">1.</span>
            <span class="leading-relaxed">{{ 'setup.openproject.tokenStep1' | translate }}</span>
          </li>
          <li class="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 shrink-0 select-none">2.</span>
            <span class="leading-relaxed">{{ 'setup.openproject.tokenStep2' | translate }}</span>
          </li>
          <li class="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 shrink-0 select-none">3.</span>
            <span class="leading-relaxed">{{ 'setup.openproject.tokenStep3' | translate }}</span>
          </li>
          <li class="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 shrink-0 select-none">4.</span>
            <span class="leading-relaxed">{{ 'setup.openproject.tokenStep4' | translate }}</span>
          </li>
          <li class="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <span class="font-mono font-bold text-primary-600 dark:text-primary-400 shrink-0 select-none">5.</span>
            <span class="leading-relaxed">{{ 'setup.openproject.tokenStep5' | translate }}</span>
          </li>
        </ol>
      </div>

      <ng-template #footer>
        <div class="flex items-center justify-end w-full pt-3 border-t border-slate-100 dark:border-zinc-800">
          <button
            pButton
            type="button"
            (click)="close()"
            size="small"
            class="px-4 cursor-pointer"
          >
            <ng-icon name="tablerCheck" size="1rem" class="mr-1.5" />
            <span>{{ 'common.understood' | translate }}</span>
          </button>
        </div>
      </ng-template>
    </p-dialog>
  `,
})
export class TokenGuideModalComponent {
  readonly visible = model<boolean>(false);

  close(): void {
    this.visible.set(false);
  }
}
