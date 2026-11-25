import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFolder, tablerLayoutKanban, tablerArrowRight } from '@ng-icons/tabler-icons';
import { Project } from '../../../../core/interfaces/openproject.interface';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CommonModule, ButtonDirective, Tag, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerFolder, tablerLayoutKanban, tablerArrowRight })],
  template: `
    <div
      (click)="openBoards.emit(project())"
      class="group p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all cursor-pointer flex flex-col justify-between gap-4 shadow-xs hover:shadow-md"
    >
      <div class="flex items-start justify-between gap-3 min-w-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <ng-icon
            name="tablerFolder"
            size="1.25rem"
            class="text-primary-600 dark:text-primary-400 shrink-0"
          />
          <h3 class="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
            {{ project().name }}
          </h3>
        </div>
        @if (project().identifier) {
          <p-tag
            [value]="project().identifier!"
            severity="secondary"
            styleClass="font-mono text-[10px]! px-2! py-0.5! shrink-0"
          />
        }
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/80">
        <span class="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
          #{{ project().id }}
        </span>
        <button
          pButton
          type="button"
          size="small"
          variant="outlined"
          severity="secondary"
          (click)="$event.stopPropagation(); openBoards.emit(project())"
          class="flex items-center gap-1.5 text-xs"
        >
          <ng-icon name="tablerLayoutKanban" size="0.95rem" />
          <span>{{ 'project.viewBoards' | translate }}</span>
          <ng-icon name="tablerArrowRight" size="0.85rem" />
        </button>
      </div>
    </div>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<Project>();
  readonly openBoards = output<Project>();
}
