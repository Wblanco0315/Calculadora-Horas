import { Injectable, inject } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { ActivityService } from '../../../core/services/activity.service';

/** PocketProject MCP setup: local database info, MCP client installation and AI rules injection. */
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

  async installMcpToClient(client: string): Promise<{ success: boolean; path: string; message: string }> {
    if (isTauri()) {
      return await invoke('install_mcp_to_client', { client });
    }
    return { success: false, path: '', message: 'Solo disponible en la app de escritorio' };
  }

  async injectAiRules(): Promise<{ success: boolean; path: string; message: string }> {
    if (isTauri()) {
      return await invoke('inject_ai_rules');
    }
    return { success: false, path: '', message: 'Solo disponible en la app de escritorio' };
  }
}
