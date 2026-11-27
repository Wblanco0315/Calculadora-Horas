import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlugConnected, tablerRefresh, tablerDownload } from '@ng-icons/tabler-icons';
import { McpService } from '../../services/mcp.service';
import { McpStatus } from '../../interfaces/mcp.interface';
import { NotificationService } from '../../../../core/services/notification.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

type TagSeverity = 'success' | 'warn' | 'danger' | 'secondary';

/**
 * Compatibility between the app and the pocketproject-mcp server: protocol, last MCP seen,
 * client configs and injected AI rules, with a one-click update of everything outdated.
 */
@Component({
  selector: 'app-mcp-status',
  standalone: true,
  imports: [ButtonDirective, ButtonIcon, ButtonLabel, Tag, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerPlugConnected, tablerRefresh, tablerDownload })],
  templateUrl: './mcp-status.component.html',
})
export class McpStatusComponent implements OnInit {
  private readonly mcpService = inject(McpService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<McpStatus | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isUpdating = signal<boolean>(false);

  readonly configuredClients = computed(() => this.status()?.clients.filter((client) => client.configured) ?? []);

  readonly connectionTag = computed<{ key: string; severity: TagSeverity }>(() => {
    const connection = this.status()?.connection;
    if (!connection) return { key: 'mcpStatus.neverConnected', severity: 'secondary' };
    if (connection.compatible) return { key: 'mcpStatus.compatible', severity: 'success' };
    return connection.reason === 'protocol_mismatch'
      ? { key: 'mcpStatus.protocolMismatch', severity: 'danger' }
      : { key: 'mcpStatus.mcpOutdated', severity: 'warn' };
  });

  readonly rulesFiles = computed(() => this.status()?.rules.filter((rules) => rules.present) ?? []);

  readonly rulesTag = computed<{ key: string; severity: TagSeverity }>(() => {
    const files = this.rulesFiles();
    if (files.length === 0) return { key: 'mcpStatus.rulesMissing', severity: 'secondary' };
    return files.every((rules) => rules.upToDate)
      ? { key: 'mcpStatus.upToDate', severity: 'success' }
      : { key: 'mcpStatus.outdated', severity: 'warn' };
  });

  readonly hasOutdated = computed(() => {
    const status = this.status();
    if (!status) return false;
    return status.clients.some((client) => client.configured && !client.upToDate) || status.rules.some((rules) => rules.present && !rules.upToDate);
  });

  async ngOnInit(): Promise<void> {
    await this.refresh();
    if (isTauri()) {
      // pocketproject-mcp announces itself through the IPC /notify endpoint when it starts.
      const unlisten = await listen<{ event?: string }>('mcp-event', (event) => {
        if (event.payload?.event === 'mcp_hello') this.refresh();
      });
      this.destroyRef.onDestroy(unlisten);
    }
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    try {
      this.status.set(await this.mcpService.getStatus());
    } catch (err) {
      console.warn('Could not load MCP status:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateOutdated(): Promise<void> {
    const status = this.status();
    if (!status) return;
    this.isUpdating.set(true);
    try {
      await this.mcpService.updateOutdated(status);
      this.notificationService.success('mcpStatus.updated');
    } catch (err) {
      this.notificationService.error('mcpStatus.updateFailed', String(err));
    } finally {
      this.isUpdating.set(false);
      await this.refresh();
    }
  }

  clientLabelKey(client: string): string {
    return `mcpStatus.client.${client}`;
  }
}
