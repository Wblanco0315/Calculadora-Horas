import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type LogoVariant = 'icon' | 'isologo' | 'vertical';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'custom';

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './app-logo.component.css',
  templateUrl: './app-logo.component.html',
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
