import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ButtonDirective, ButtonIcon, ButtonLabel } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerPlugConnected, tablerRefresh, tablerDownload } from '@ng-icons/tabler-icons';
import { McpCompatibilityService } from '../../../../core/services/mcp-compatibility.service';
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
  private readonly compatibility = inject(McpCompatibilityService);
  private readonly notificationService = inject(NotificationService);

  /** Shared with the global update dialog; refreshed whenever an MCP server starts. */
  readonly status = this.compatibility.status;
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
    return this.compatibility.outdatedClients().length > 0 || status.rules.some((rules) => rules.present && !rules.upToDate);
  });

  async ngOnInit(): Promise<void> {
    // Also covers the onboarding, which runs before AppComponent starts the shared listener.
    this.compatibility.start();
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.compatibility.refresh();
    } finally {
      this.isLoading.set(false);
    }
  }

  async updateOutdated(): Promise<void> {
    this.isUpdating.set(true);
    try {
      await this.compatibility.updateOutdated();
      this.notificationService.success('mcpStatus.updated');
    } catch (err) {
      this.notificationService.error('mcpStatus.updateFailed', String(err));
    } finally {
      this.isUpdating.set(false);
    }
  }

  clientLabelKey(client: string): string {
    return `mcpStatus.client.${client}`;
  }
}
