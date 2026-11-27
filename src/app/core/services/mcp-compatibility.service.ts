import { Injectable, computed, inject, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { McpClientStatus, McpInstallResult, McpStatus } from '../interfaces/mcp.interface';
import { StorageService } from './storage.service';

/**
 * App <-> pocketproject-mcp compatibility, shared by the settings panel and the global
 * "update your MCP" dialog.
 *
 * An update is required when the last MCP that started on this machine is incompatible with this app
 * version (`protocol_mismatch` or `mcp_outdated`, e.g. after an app update raised `MIN_MCP_VERSION`)
 * or when a configured AI client still points to an old package spec. The status is checked on app
 * start and every time an MCP server announces itself (`mcp_hello`).
 */
@Injectable({ providedIn: 'root' })
export class McpCompatibilityService {
  private readonly storageService = inject(StorageService);
  private started = false;
  /** Situation the user postponed with "Later"; the dialog comes back when it changes or on restart. */
  private readonly dismissedKey = signal<string | null>(null);

  readonly status = signal<McpStatus | null>(null);

  /** Configured AI clients whose config uses an outdated package spec. */
  readonly outdatedClients = computed<McpClientStatus[]>(
    () => this.status()?.clients.filter((client) => client.configured && !client.upToDate) ?? [],
  );

  /** The last MCP seen cannot work with this app version. */
  readonly incompatibleConnection = computed(() => {
    const connection = this.status()?.connection;
    return connection ? !connection.compatible : false;
  });

  readonly updateRequired = computed(() => this.incompatibleConnection() || this.outdatedClients().length > 0);

  /** Identifies the current situation, so a postponed notice reappears when anything changes. */
  private readonly situationKey = computed(() => {
    const status = this.status();
    if (!status || !this.updateRequired()) return null;
    const runtime = status.connection?.compatible === false ? status.connection.runtime : null;
    return [
      status.contract.minMcpVersion,
      status.contract.packageSpec,
      runtime ? `${runtime.mcpVersion}/${runtime.protocolVersion}` : '-',
      this.outdatedClients()
        .map((client) => `${client.client}:${client.packageSpec ?? ''}`)
        .join(','),
    ].join('|');
  });

  /** The onboarding shows the MCP status in its own step, so the dialog waits until it is done. */
  readonly showDialog = computed(() => {
    const key = this.situationKey();
    return key !== null && key !== this.dismissedKey() && this.storageService.isConfigured();
  });

  /** Loads the status and listens for MCP servers starting (called once by `AppComponent`). */
  start(): void {
    if (this.started || !isTauri()) return;
    this.started = true;
    void this.refresh();
    // pocketproject-mcp writes mcp-runtime.json and posts `mcp_hello` to /notify when it starts.
    listen<{ event?: string }>('mcp-event', (event) => {
      if (event.payload?.event === 'mcp_hello') void this.refresh();
    }).catch((err) => console.warn('Could not listen to MCP events:', err));
  }

  async refresh(): Promise<McpStatus | null> {
    if (!isTauri()) return null;
    try {
      this.status.set(await invoke<McpStatus>('get_mcp_status'));
    } catch (err) {
      console.warn('Could not load MCP status:', err);
    }
    return this.status();
  }

  /** Rewrites outdated client configs and, when outdated, the injected AI rules; then reloads the status. */
  async updateOutdated(): Promise<void> {
    const status = this.status() ?? (await this.refresh());
    if (!status) return;
    try {
      for (const client of status.clients) {
        if (client.configured && !client.upToDate) {
          const result = await invoke<McpInstallResult>('install_mcp_to_client', { client: client.client });
          if (!result.success) throw new Error(result.message);
        }
      }
      if (status.rules.some((rules) => rules.present && !rules.upToDate)) {
        await invoke<number>('refresh_mcp_rules');
      }
    } finally {
      await this.refresh();
    }
  }

  /** Hides the dialog until the situation changes or the app restarts. */
  dismiss(): void {
    this.dismissedKey.set(this.situationKey());
  }
}
