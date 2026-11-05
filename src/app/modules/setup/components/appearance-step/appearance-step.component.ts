import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppearanceEditorComponent } from '../../../../shared/components/appearance-editor/appearance-editor.component';

@Component({
  selector: 'app-appearance-step',
  standalone: true,
  imports: [CommonModule, AppearanceEditorComponent],
  template: `
    <app-appearance-editor [showTitle]="true" [showSaveButton]="false" />
  `,
})
export class AppearanceStepComponent {}
