import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScheduleEditorComponent } from '../../../../shared/components/schedule-editor/schedule-editor.component';

@Component({
  selector: 'app-schedule-step',
  standalone: true,
  imports: [CommonModule, ScheduleEditorComponent],
  template: `
    <app-schedule-editor [showTitle]="true" [showLunch]="false" />
  `,
})
export class ScheduleStepComponent {}
