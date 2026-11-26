import { Component, inject } from '@angular/core';
import { WindowService } from '../../../core/services/window.service';
import { AppLogoComponent } from '../app-logo/app-logo.component';

/**
 * Full-window cover shown while the window switches between compact and full mode, so the
 * resize/move and the route change are not seen half-way (layout stretching and jumping).
 */
@Component({
  selector: 'app-window-transition',
  standalone: true,
  imports: [AppLogoComponent],
  template: `
    <div
      class="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-50 transition-opacity duration-150 ease-out dark:bg-zinc-950"
      [class.opacity-100]="windowService.isTransitioning()"
      [class.opacity-0]="!windowService.isTransitioning()"
      [class.pointer-events-none]="!windowService.isTransitioning()"
      [attr.aria-hidden]="!windowService.isTransitioning()"
    >
      <app-logo variant="icon" size="xl" class="animate-pulse" />
    </div>
  `,
})
export class WindowTransitionComponent {
  readonly windowService = inject(WindowService);
}
