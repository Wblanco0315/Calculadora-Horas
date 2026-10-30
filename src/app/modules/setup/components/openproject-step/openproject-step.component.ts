import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SetupService } from '../../services/setup.service';
import { OpenprojectConnectionComponent } from '../../../../shared/components/openproject-connection/openproject-connection.component';

@Component({
  selector: 'app-openproject-step',
  standalone: true,
  imports: [CommonModule, OpenprojectConnectionComponent],
  template: `
    <app-openproject-connection
      [(url)]="setupService.openprojectUrl"
      [(token)]="setupService.openprojectToken"
      [(testResult)]="setupService.testResult"
      [showTitle]="true"
      [showSaveButton]="false"
    />
  `,
})
export class OpenprojectStepComponent {
  readonly setupService = inject(SetupService);
}
