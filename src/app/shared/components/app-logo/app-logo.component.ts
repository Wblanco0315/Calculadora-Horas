import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoVariant = 'icon' | 'isologo' | 'vertical';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
      }
      :host svg:not([data-custom-size]) {
        width: var(--app-logo-w) !important;
        height: var(--app-logo-h) !important;
        flex-shrink: 0;
      }
    `,
  ],
  template: `
    <div
      class="inline-flex items-center select-none"
      [class.flex-col]="variant() === 'vertical'"
      [class.gap-1.5]="variant() === 'isologo' && (size() === 'xs' || size() === 'sm')"
      [class.gap-2.5]="variant() === 'isologo' && (size() === 'md' || size() === 'lg')"
      [class.gap-3.5]="variant() === 'isologo' && size() === 'xl'"
      [class.gap-2]="variant() === 'vertical'"
    >
      <!-- Graphic Symbol (Dual-P Squircle Interlock a 14° - M.2) -->
      <svg
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        [attr.data-custom-size]="isCustom() ? 'true' : null"
        [style.--app-logo-w]="svgDimensions().width"
        [style.--app-logo-h]="svgDimensions().height"
        [style.width]="svgDimensions().width"
        [style.height]="svgDimensions().height"
        [style.min-width]="isCustom() ? null : svgDimensions().width"
        [style.min-height]="isCustom() ? null : svgDimensions().height"
        [class]="iconSizeClasses()"
        class="shrink-0 transition-transform duration-200"
      >
        <defs>
          <mask [attr.id]="maskTopId">
            <rect width="512" height="512" fill="white" />
            <circle cx="230" cy="276" r="16" fill="black" />
          </mask>
          <mask [attr.id]="maskBotId">
            <rect width="512" height="512" fill="white" />
            <circle cx="282" cy="236" r="16" fill="black" />
          </mask>
        </defs>

        <g transform="rotate(-14 256 256)">
          @if (!negative()) {
            <!-- POSITIVE MODE: Adaptive to theme palette -->
            <!-- Top P: Primary Indigo -->
            <path
              [attr.mask]="'url(#' + maskTopId + ')'"
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M 254 48 C 240 48 230 58 230 72 V 344 C 230 358 240 368 256 368 C 272 368 282 358 282 344 V 256 H 312 C 370 256 416 210 416 152 C 416 94 370 48 312 48 H 254 Z M 282 100 H 312 C 340 100 364 124 364 152 C 364 180 340 204 312 204 H 282 V 100 Z"
              class="fill-primary-600 dark:fill-primary-500 transition-colors"
            />
            <!-- Bottom P: Slate in light, White in dark -->
            <path
              [attr.mask]="'url(#' + maskBotId + ')'"
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M 258 464 C 272 464 282 454 282 440 V 168 C 282 154 272 144 256 144 C 240 144 230 154 230 168 V 256 H 200 C 142 256 96 302 96 360 C 96 418 142 464 200 464 H 258 Z M 230 412 H 200 C 172 412 148 388 148 360 C 148 332 172 308 200 308 H 230 V 412 Z"
              class="fill-slate-900 dark:fill-white transition-colors"
            />
          } @else {
            <!-- NEGATIVE MODE: White Monochrome with 3D Depth Opacity -->
            <!-- Top P: Solid White -->
            <path
              [attr.mask]="'url(#' + maskTopId + ')'"
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M 254 48 C 240 48 230 58 230 72 V 344 C 230 358 240 368 256 368 C 272 368 282 358 282 344 V 256 H 312 C 370 256 416 210 416 152 C 416 94 370 48 312 48 H 254 Z M 282 100 H 312 C 340 100 364 124 364 152 C 364 180 340 204 312 204 H 282 V 100 Z"
              fill="#FFFFFF"
            />
            <!-- Bottom P: High-opacity White -->
            <path
              [attr.mask]="'url(#' + maskBotId + ')'"
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M 258 464 C 272 464 282 454 282 440 V 168 C 282 154 272 144 256 144 C 240 144 230 154 230 168 V 256 H 200 C 142 256 96 302 96 360 C 96 418 142 464 200 464 H 258 Z M 230 412 H 200 C 172 412 148 388 148 360 C 148 332 172 308 200 308 H 230 V 412 Z"
              fill="#FFFFFF"
              fill-opacity="0.80"
            />
          }
        </g>
      </svg>

      <!-- Typographic Wordmark for Isologo and Vertical variants -->
      @if (variant() === 'isologo' || variant() === 'vertical') {
        <span
          class="font-display tracking-tight leading-none pointer-events-none"
          [class]="textSizeClasses()"
        >
          @if (!negative()) {
            <span class="font-bold text-slate-800 dark:text-zinc-100">Pocket</span>
            <span class="font-extrabold text-primary-600 dark:text-primary-400">Project</span>
          } @else {
            <span class="font-bold text-white">Pocket</span>
            <span class="font-medium text-white/80">Project</span>
          }
        </span>
      }
    </div>
  `,
})
export class AppLogoComponent {
  readonly variant = input<LogoVariant>('icon');
  readonly negative = input<boolean>(false);
  readonly size = input<LogoSize>('md');
  readonly customIconClass = input<string>('');

  private readonly instanceId = Math.random().toString(36).substring(2, 9);
  protected readonly maskTopId = `pp-m2-top-${this.instanceId}`;
  protected readonly maskBotId = `pp-m2-bot-${this.instanceId}`;

  readonly isCustom = computed<boolean>(() => this.size() === 'custom' || !!this.customIconClass());

  readonly svgDimensions = computed<{ width: string; height: string }>(() => {
    if (this.isCustom()) {
      return { width: 'auto', height: 'auto' };
    }
    switch (this.size()) {
      case 'xs':
        return { width: '18px', height: '18px' };
      case 'sm':
        return { width: '24px', height: '24px' };
      case 'md':
        return { width: '32px', height: '32px' };
      case 'lg':
        return { width: '42px', height: '42px' };
      case 'xl':
        return { width: '56px', height: '56px' };
      default:
        return { width: '32px', height: '32px' };
    }
  });

  readonly iconSizeClasses = computed<string>(() => {
    if (this.customIconClass()) {
      return this.customIconClass();
    }
    const aspect = 'aspect-square';
    switch (this.size()) {
      case 'xs':
        return `!h-[18px] !w-[18px] ${aspect}`;
      case 'sm':
        return `!h-6 !w-6 ${aspect}`;
      case 'md':
        return `!h-8 !w-8 ${aspect}`;
      case 'lg':
        return `!h-[42px] !w-[42px] ${aspect}`;
      case 'xl':
        return `!h-14 !w-14 ${aspect}`;
      default:
        return `!h-8 !w-8 ${aspect}`;
    }
  });

  readonly textSizeClasses = computed<string>(() => {
    switch (this.size()) {
      case 'xs':
        return 'text-xs';
      case 'sm':
        return 'text-sm';
      case 'md':
        return 'text-base';
      case 'lg':
        return 'text-xl';
      case 'xl':
        return 'text-3xl';
      default:
        return 'text-base';
    }
  });
}
