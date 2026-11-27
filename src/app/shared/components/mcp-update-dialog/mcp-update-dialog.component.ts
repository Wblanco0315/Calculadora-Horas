import { Component, computed, inject, signal } from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerAlertTriangle, tablerArrowRight, tablerCheck, tablerCopy, tablerDownload } from '@ng-icons/tabler-icons';
import { McpCompatibilityService } from '../../../core/services/mcp-compatibility.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Asks the user to update pocketproject-mcp when this app version requires a newer one
 * (incompatible MCP seen, or AI clients configured with an old package spec).
 */
@Component({
  selector: 'app-mcp-update-dialog',
  standalone: true,
  imports: [Dialog, ButtonDirective, Tag, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerAlertTriangle, tablerArrowRight, tablerCheck, tablerCopy, tablerDownload })],
  templateUrl: './mcp-update-dialog.component.html',
})
export class McpUpdateDialogComponent {
  readonly compatibility = inject(McpCompatibilityService);
  private readonly notificationService = inject(NotificationService);

  readonly isUpdating = signal(false);
  readonly copied = signal(false);

  readonly contract = computed(() => this.compatibility.status()?.contract ?? null);
  readonly connection = computed(() => this.compatibility.status()?.connection ?? null);

  readonly reasonKey = computed(() =>
    this.connection()?.reason === 'protocol_mismatch' ? 'mcpUpdate.reasonProtocol' : 'mcpUpdate.reasonOutdated',
  );

  /** Quick setup with the package spec of this app version: downloads the newest compatible MCP. */
  readonly command = computed(() => `npx -y ${this.contract()?.packageSpec ?? 'pocketproject-mcp'} setup`);

  clientLabelKey(client: string): string {
    return `mcpStatus.client.${client}`;
  }

  onVisibleChange(visible: boolean): void {
    if (!visible) this.compatibility.dismiss();
  }

  async updateClients(): Promise<void> {
    this.isUpdating.set(true);
    try {
      await this.compatibility.updateOutdated();
      this.notificationService.success('mcpUpdate.clientsUpdated');
    } catch (err) {
      this.notificationService.error('mcpStatus.updateFailed', String(err));
    } finally {
      this.isUpdating.set(false);
    }
  }

  async copyCommand(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.command());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {}
  }
}
