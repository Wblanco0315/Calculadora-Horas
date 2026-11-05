import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoVariant = 'icon' | 'isologo' | 'vertical';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="inline-flex items-center select-none"
      [class.flex-col]="variant() === 'vertical'"
      [class.gap-1.5]="variant() === 'isologo' && (size() === 'xs' || size() === 'sm')"
      [class.gap-2.5]="variant() === 'isologo' && (size() === 'md' || size() === 'lg')"
      [class.gap-3.5]="variant() === 'isologo' && size() === 'xl'"
      [class.gap-2]="variant() === 'vertical'"
    >
      <!-- Graphic Symbol (Legacy Clock + Calculator Emblem) -->
      <svg
        viewBox="0 0 747 789"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        [class]="iconSizeClasses()"
        class="shrink-0 transition-transform duration-200"
      >
        @if (!negative()) {
          <!-- POSITIVE MODE (Light Theme): Adaptive to dynamic primary palette -->
          <!-- Clock Outer Bevel (Depth) -->
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M199.039 150.181L400.44 276.451V503.992C399.289 504.651 199.039 623.902 199.039 623.902L0.449066 503.992L0 268.855L199.039 150.181ZM362.231 483.337L199.039 582.01L36.7436 483.206L37.5315 288.057L199.039 189.984L362.174 288.057L362.231 483.337Z"
            class="fill-primary-700 dark:fill-primary-600 transition-colors"
          />
          <!-- Clock Face (Primary Surface) -->
          <path
            d="M199.039 582.01L362.231 483.337L362.174 288.057L199.039 189.984L37.5315 288.057L36.7436 483.206L199.039 582.01Z"
            class="fill-primary-500 transition-colors"
          />
          <!-- Clock Hands (Indicator) -->
          <path
            d="M203.628 272.026L187.472 272.109C187.472 272.109 187.098 384.807 187.015 412.018C187.006 414.784 189.247 416.957 192.013 416.957H213.781C214.745 416.957 215.689 416.679 216.498 416.155L298.971 362.764C301.326 361.239 301.963 358.071 300.385 355.751L293.167 345.138C292.25 343.791 290.893 343.511 289.518 344.386C277.28 352.169 217.596 389.98 209.659 394.207C209.088 394.511 208.787 394.248 208.787 393.601L208.664 277.021C208.662 274.251 206.398 272.012 203.628 272.026Z"
            class="fill-slate-900 dark:fill-white transition-colors"
          />
          <!-- Lower Ribbon -->
          <path d="M400.44 789L215.394 661.617L400.44 532.227V789Z" class="fill-primary-700 dark:fill-primary-600 transition-colors" />
          <path d="M400.44 789V532.227L471.498 490.836V576.646L746.106 576.549L400.44 789Z" class="fill-primary-500 transition-colors" />
          <!-- Upper Ribbon -->
          <path d="M400.44 4.57764e-05L215.394 127.471L400.44 240.29V4.57764e-05Z" class="fill-primary-700 dark:fill-primary-600 transition-colors" />
          <path d="M400.44 -6.10352e-05V240.29L471.498 282.414V212.354L746.106 212.451L400.44 -6.10352e-05Z" class="fill-primary-500 transition-colors" />
          <!-- Calculator Casing -->
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M730.562 547.679H501.105V246.56L730.562 246.56V547.679ZM704.813 270.009L527.978 270.467L528.102 318.566H704.813V270.009Z"
            class="fill-primary-500 transition-colors"
          />
          <!-- Calculator Screen -->
          <path d="M527.978 270.467L704.813 270.009V318.566H528.102L527.978 270.467Z" class="fill-primary-800 dark:fill-primary-900 transition-colors" />
          <!-- Calculator Keys -->
          <g class="fill-primary-700 dark:fill-primary-600 transition-colors">
            <path d="M527.289 339.394H577.886V378.67H527.289V339.394Z" />
            <path d="M590.015 339.394H640.612V378.67H590.015V339.394Z" />
            <path d="M653.781 339.394H704.378V378.67H653.781V339.394Z" />
            <path d="M527.289 437.24H577.886V476.517H527.289V437.24Z" />
            <path d="M590.015 437.24H640.612V476.517H590.015V437.24Z" />
            <path d="M527.289 488.92H577.886V528.196H527.289V488.92Z" />
            <path d="M590.015 488.92H640.612V528.196H590.015V488.92Z" />
            <path d="M527.289 389.006H577.886V428.283H527.289V389.006Z" />
            <path d="M590.015 389.006H640.612V428.283H590.015V389.006Z" />
            <path d="M653.781 389.006H704.378V428.283H653.781V389.006Z" />
            <path d="M653.781 437.241H679.079H704.378V526.474H653.781V437.241Z" />
          </g>
        } @else {
          <!-- NEGATIVE MODE (Dark Theme / High Contrast White Silhouette) -->
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M199.039 150.181L400.44 276.451V503.992C399.289 504.651 199.039 623.902 199.039 623.902L0.449066 503.992L0 268.855L199.039 150.181ZM362.231 483.337L199.039 582.01L36.7436 483.206L37.5315 288.057L199.039 189.984L362.174 288.057L362.231 483.337Z"
            fill="#FFFFFF"
            fill-opacity="0.65"
          />
          <path
            d="M199.039 582.01L362.231 483.337L362.174 288.057L199.039 189.984L37.5315 288.057L36.7436 483.206L199.039 582.01Z"
            fill="#FFFFFF"
          />
          <path
            d="M203.628 272.026L187.472 272.109C187.472 272.109 187.098 384.807 187.015 412.018C187.006 414.784 189.247 416.957 192.013 416.957H213.781C214.745 416.957 215.689 416.679 216.498 416.155L298.971 362.764C301.326 361.239 301.963 358.071 300.385 355.751L293.167 345.138C292.25 343.791 290.893 343.511 289.518 344.386C277.28 352.169 217.596 389.98 209.659 394.207C209.088 394.511 208.787 394.248 208.787 393.601L208.664 277.021C208.662 274.251 206.398 272.012 203.628 272.026Z"
            fill="#09090B"
          />
          <path d="M400.44 789L215.394 661.617L400.44 532.227V789Z" fill="#FFFFFF" fill-opacity="0.65" />
          <path d="M400.44 789V532.227L471.498 490.836V576.646L746.106 576.549L400.44 789Z" fill="#FFFFFF" />
          <path d="M400.44 4.57764e-05L215.394 127.471L400.44 240.29V4.57764e-05Z" fill="#FFFFFF" fill-opacity="0.65" />
          <path d="M400.44 -6.10352e-05V240.29L471.498 282.414V212.354L746.106 212.451L400.44 -6.10352e-05Z" fill="#FFFFFF" />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M730.562 547.679H501.105V246.56L730.562 246.56V547.679ZM704.813 270.009L527.978 270.467L528.102 318.566H704.813V270.009Z"
            fill="#FFFFFF"
          />
          <path d="M527.978 270.467L704.813 270.009V318.566H528.102L527.978 270.467Z" fill="#09090B" />
          <g fill="#09090B">
            <path d="M527.289 339.394H577.886V378.67H527.289V339.394Z" />
            <path d="M590.015 339.394H640.612V378.67H590.015V339.394Z" />
            <path d="M653.781 339.394H704.378V378.67H653.781V339.394Z" />
            <path d="M527.289 437.24H577.886V476.517H527.289V437.24Z" />
            <path d="M590.015 437.24H640.612V476.517H590.015V437.24Z" />
            <path d="M527.289 488.92H577.886V528.196H527.289V488.92Z" />
            <path d="M590.015 488.92H640.612V528.196H590.015V488.92Z" />
            <path d="M527.289 389.006H577.886V428.283H527.289V389.006Z" />
            <path d="M590.015 389.006H640.612V428.283H590.015V389.006Z" />
            <path d="M653.781 389.006H704.378V428.283H653.781V389.006Z" />
            <path d="M653.781 437.241H679.079H704.378V526.474H653.781V437.241Z" />
          </g>
        }
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

  readonly iconSizeClasses = computed<string>(() => {
    if (this.customIconClass()) {
      return this.customIconClass();
    }
    const aspect = 'aspect-[747/789]';
    switch (this.size()) {
      case 'xs':
        return `h-4.5 w-auto ${aspect}`;
      case 'sm':
        return `h-6 w-auto ${aspect}`;
      case 'md':
        return `h-8 w-auto ${aspect}`;
      case 'lg':
        return `h-10 w-auto ${aspect}`;
      case 'xl':
        return `h-14 w-auto ${aspect}`;
      default:
        return `h-8 w-auto ${aspect}`;
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
