import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppearanceEditorComponent } from '../../../../shared/components/appearance-editor/appearance-editor.component';
import { OpenprojectConnectionComponent } from '../../../../shared/components/openproject-connection/openproject-connection.component';
import { UpdateSectionComponent } from '../update-section/update-section.component';

@Component({
  selector: 'app-system-section',
  standalone: true,
  imports: [
    CommonModule,
    AppearanceEditorComponent,
    OpenprojectConnectionComponent,
    UpdateSectionComponent,
  ],
  template: `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- 1. Appearance & Language -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <app-appearance-editor [showTitle]="true" [showSaveButton]="true" />
      </div>

      <!-- 2. OpenProject Connection -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
        <app-openproject-connection [showTitle]="true" [showSaveButton]="true" />
      </div>

      <!-- 3. Automatic Updates -->
      <div class="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4 lg:col-span-2">
        <app-update-section />
      </div>
    </div>
  `,
})
export class SystemSectionComponent {}
