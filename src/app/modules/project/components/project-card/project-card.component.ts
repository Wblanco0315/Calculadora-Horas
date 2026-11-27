import { Component, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerFolder } from '@ng-icons/tabler-icons';
import { Project } from '../../../../core/interfaces/openproject.interface';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [NgIcon],
  viewProviders: [provideIcons({ tablerFolder })],
  template: `
    <button
      type="button"
      (click)="openBoards.emit(project())"
      [title]="project().name"
      class="flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-primary-400 focus-visible:outline-2 focus-visible:outline-primary-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-primary-600"
    >
      <ng-icon name="tablerFolder" size="1.15rem" class="shrink-0 text-primary-600 dark:text-primary-400" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">{{ project().name }}</span>
        @if (project().identifier) {
          <span class="block truncate font-mono text-[11px] text-slate-400 dark:text-zinc-500">{{ project().identifier }}</span>
        }
      </span>
    </button>
  `,
})
export class ProjectCardComponent {
  readonly project = input.required<Project>();
  readonly openBoards = output<Project>();
}
