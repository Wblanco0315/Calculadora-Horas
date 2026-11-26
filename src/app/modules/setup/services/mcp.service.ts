import { Injectable, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { ActivityService } from '../../../core/services/activity.service';
import { McpContract, McpInstallResult, McpStatus } from '../interfaces/mcp.interface';

const DESKTOP_ONLY: McpInstallResult = { success: false, path: '', message: 'Solo disponible en la app de escritorio' };

/**
 * PocketProject MCP: local database info, client installation, AI rules and the compatibility
 * contract. The system prompt comes only from the app (`get_mcp_contract`), never from a copy here.
 */
@Injectable({ providedIn: 'root' })
export class McpService {
  private readonly activityService = inject(ActivityService);

  async getDatabasePath(): Promise<string> {
    if (isTauri()) {
      try {
        return await invoke<string>('get_database_path');
      } catch (e) {
        console.warn('Failed to get database path:', e);
      }
    }
    return 'pocketproject.sqlite';
  }

  async getAiStats(): Promise<number> {
    if (isTauri()) {
      try {
        return await invoke<number>('get_ai_stats');
      } catch (e) {
        console.warn('Failed to get AI stats:', e);
      }
    }
    return this.activityService.activities().filter((a) => a.createdByAi).length;
  }

  async installMcpToClient(client: string): Promise<McpInstallResult> {
    return isTauri() ? invoke<McpInstallResult>('install_mcp_to_client', { client }) : DESKTOP_ONLY;
  }

  /** Asks for the project folder whose agent rules file should receive the PocketProject rules. */
  async pickProjectFolder(): Promise<string | null> {
    if (!isTauri()) return null;
    const selected = await open({ directory: true, multiple: false });
    return typeof selected === 'string' ? selected : null;
  }

  /**
   * Injects the AI rules into the project folder's `.agents/RULES.md`, `.cursorrules` or `AGENTS.md`
   * and registers the file, so the app refreshes it whenever the system prompt changes.
   */
  async injectAiRules(projectDir?: string): Promise<McpInstallResult> {
    return isTauri() ? invoke<McpInstallResult>('inject_ai_rules', { projectDir: projectDir ?? null }) : DESKTOP_ONLY;
  }

  /** Rewrites outdated rules blocks in every registered project; returns how many files changed. */
  async refreshRules(): Promise<number> {
    return isTauri() ? invoke<number>('refresh_mcp_rules') : 0;
  }

  /** Contract with the single system prompt; `null` outside the desktop app. */
  async getContract(): Promise<McpContract | null> {
    return isTauri() ? invoke<McpContract>('get_mcp_contract') : null;
  }

  async getStatus(): Promise<McpStatus | null> {
    return isTauri() ? invoke<McpStatus>('get_mcp_status') : null;
  }

  /** Rewrites outdated client configs and the injected rules block when it is outdated. */
  async updateOutdated(status: McpStatus): Promise<void> {
    for (const client of status.clients) {
      if (client.configured && !client.upToDate) {
        await this.installMcpToClient(client.client);
      }
    }
    if (status.rules.some((rules) => rules.present && !rules.upToDate)) {
      await this.refreshRules();
    }
  }
}
