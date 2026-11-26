import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonDirective } from 'primeng/button';
import { Tabs, TabList, Tab } from 'primeng/tabs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  tablerRobot,
  tablerCopy,
  tablerCheck,
  tablerDatabase,
  tablerChevronDown,
  tablerChevronUp,
  tablerBolt,
  tablerTerminal2,
  tablerSparkles,
  tablerPackage,
  tablerShieldCheck,
  tablerClock,
} from '@ng-icons/tabler-icons';
import { McpService } from '../../services/mcp.service';
import { McpStatusComponent } from '../mcp-status/mcp-status.component';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';

export type McpClientType = 'quick_setup' | 'antigravity' | 'agy_cli' | 'cursor' | 'claude_desktop' | 'claude_code';

@Component({
  selector: 'app-mcp-section',
  standalone: true,
  imports: [CommonModule, ButtonDirective, Tabs, TabList, Tab, NgIcon, TranslatePipe, McpStatusComponent],
  viewProviders: [
    provideIcons({
      tablerRobot,
      tablerCopy,
      tablerCheck,
      tablerDatabase,
      tablerChevronDown,
      tablerChevronUp,
      tablerBolt,
      tablerTerminal2,
      tablerSparkles,
      tablerPackage,
      tablerShieldCheck,
      tablerClock,
    }),
  ],
  templateUrl: './mcp-section.component.html',
})
export class McpSectionComponent implements OnInit {
  private readonly mcpService = inject(McpService);

  readonly dbPath = signal<string>('pocketproject.sqlite');
  readonly aiActivitiesCount = signal<number>(0);
  readonly selectedClient = signal<McpClientType>('quick_setup');
  readonly showPromptDetails = signal<boolean>(false);

  readonly isInstalling = signal<boolean>(false);
  readonly installFeedback = signal<string | null>(null);

  readonly isInjectingRules = signal<boolean>(false);
  readonly injectFeedback = signal<string | null>(null);

  readonly copiedDbPath = signal<boolean>(false);
  readonly copiedSnippet = signal<boolean>(false);
  readonly copiedPrompt = signal<boolean>(false);

  /** Single AI system prompt and npm spec, both from the app's MCP contract. */
  readonly rules = signal<string>('');
  readonly packageSpec = signal<string>('pocketproject-mcp@1');

  async ngOnInit(): Promise<void> {
    const path = await this.mcpService.getDatabasePath();
    this.dbPath.set(path);

    const count = await this.mcpService.getAiStats();
    this.aiActivitiesCount.set(count);

    const contract = await this.mcpService.getContract();
    if (contract) {
      this.rules.set(contract.rules);
      this.packageSpec.set(contract.packageSpec);
    }
  }

  selectClient(client: unknown): void {
    if (client) {
      this.selectedClient.set(client as McpClientType);
      this.installFeedback.set(null);
    }
  }

  canAutoInstall(): boolean {
    const client = this.selectedClient();
    return client === 'antigravity' || client === 'cursor' || client === 'claude_desktop';
  }

  isCliMode(): boolean {
    const client = this.selectedClient();
    return client === 'quick_setup' || client === 'agy_cli' || client === 'claude_code';
  }

  currentHintKey(): string {
    const client = this.selectedClient();
    switch (client) {
      case 'quick_setup':
        return 'setup.mcp.clientHintQuickSetup';
      case 'antigravity':
        return 'setup.mcp.clientHintAntigravity';
      case 'agy_cli':
        return 'setup.mcp.clientHintAgyCli';
      case 'cursor':
        return 'setup.mcp.clientHintCursor';
      case 'claude_desktop':
        return 'setup.mcp.clientHintClaudeDesktop';
      case 'claude_code':
        return 'setup.mcp.clientHintClaudeCode';
    }
  }

  currentSnippet(): string {
    const client = this.selectedClient();

    switch (client) {
      case 'quick_setup':
        return `npx -y ${this.packageSpec()} setup`;

      case 'antigravity':
        return JSON.stringify(
          {
            mcpServers: {
              pocketproject: {
                command: 'npx',
                args: ['-y', this.packageSpec()],
              },
            },
          },
          null,
          2
        );

      case 'agy_cli':
        return `agy mcp add pocketproject -- npx -y ${this.packageSpec()}`;

      case 'cursor':
        return JSON.stringify(
          {
            mcpServers: {
              pocketproject: {
                command: 'npx',
                args: ['-y', this.packageSpec()],
              },
            },
          },
          null,
          2
        );

      case 'claude_desktop':
        return JSON.stringify(
          {
            mcpServers: {
              pocketproject: {
                command: 'npx',
                args: ['-y', this.packageSpec()],
              },
            },
          },
          null,
          2
        );

      case 'claude_code':
        return `claude mcp add -s user pocketproject -- npx -y ${this.packageSpec()}`;
    }
  }

  async autoInstall(): Promise<void> {
    const client = this.selectedClient();
    this.isInstalling.set(true);
    this.installFeedback.set(null);

    try {
      const res = await this.mcpService.installMcpToClient(client);
      if (res.success) {
        this.installFeedback.set(res.message);
      } else {
        this.installFeedback.set('Error: ' + res.message);
      }
    } catch (e: any) {
      this.installFeedback.set('Error: ' + (e?.message || e));
    } finally {
      this.isInstalling.set(false);
    }
  }

  async autoInjectRules(): Promise<void> {
    const projectDir = await this.mcpService.pickProjectFolder();
    if (!projectDir) return;

    this.isInjectingRules.set(true);
    this.injectFeedback.set(null);

    try {
      const res = await this.mcpService.injectAiRules(projectDir);
      if (res.success) {
        this.injectFeedback.set(res.message);
      } else {
        this.injectFeedback.set('Error: ' + res.message);
      }
    } catch (e: any) {
      this.injectFeedback.set('Error: ' + (e?.message || e));
    } finally {
      this.isInjectingRules.set(false);
    }
  }

  async copyDbPath(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.dbPath());
      this.copiedDbPath.set(true);
      setTimeout(() => this.copiedDbPath.set(false), 2000);
    } catch {}
  }

  async copySnippet(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.currentSnippet());
      this.copiedSnippet.set(true);
      setTimeout(() => this.copiedSnippet.set(false), 2000);
    } catch {}
  }

  async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.rules());
      this.copiedPrompt.set(true);
      setTimeout(() => this.copiedPrompt.set(false), 2000);
    } catch {}
  }
}
