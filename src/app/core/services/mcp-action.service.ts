import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { WindowService } from '../window/window.service';
import { StorageService } from './storage.service';
import { TicketIntentService } from './ticket-intent.service';

/** Payload of the `mcp-action` event (validated by the Rust `service::mcp_api::run_action`). */
interface McpAction {
  action: 'open_app' | 'set_mode' | 'navigate' | 'open_ticket' | 'draft_comment' | 'upload_attachment';
  mode?: 'compact' | 'full';
  view?: string;
  params?: Record<string, string | number | boolean | null | undefined>;
  ticket?: string | number;
  text?: string;
}

/**
 * Carries out the interface actions the PocketProject MCP requests (`POST /action` → `mcp-action`):
 * open the app, switch mode, open a view or a ticket, and prepare work the user finishes:
 * a comment draft (the user sends it) or an attachment upload (the user picks the file).
 * The window is already shown and focused by Rust.
 */
@Injectable({ providedIn: 'root' })
export class McpActionService {
  private readonly router = inject(Router);
  private readonly windowService = inject(WindowService);
  private readonly storageService = inject(StorageService);
  private readonly intents = inject(TicketIntentService);
  private started = false;

  /** Registers the listeners once (called by `AppComponent`). */
  start(): void {
    if (this.started || !isTauri()) return;
    this.started = true;
    listen<McpAction>('mcp-action', (event) => void this.run(event.payload)).catch((err) =>
      console.warn('Could not listen to MCP actions:', err),
    );
    listen<{ event?: string; data?: { ticket?: string | number } }>('mcp-event', (event) => {
      if (event.payload?.event !== 'ticket_updated') return;
      const ticket = Number(event.payload.data?.ticket);
      if (Number.isSafeInteger(ticket) && ticket > 0) this.intents.notifyTicketUpdated(ticket);
    }).catch((err) => console.warn('Could not listen to MCP events:', err));
  }

  async run(action: McpAction): Promise<void> {
    // Until the app is configured, only the onboarding is reachable.
    if (!this.storageService.isConfigured()) return;
    const ticket = Number(String(action.ticket ?? '').replace(/^#/, ''));
    switch (action.action) {
      case 'open_app':
        return;
      case 'set_mode':
        if (action.mode === 'full') await this.windowService.setFullMode();
        else if (action.mode === 'compact') await this.windowService.setCompactMode();
        return;
      case 'navigate':
        await this.navigate(action.view ?? '', action.params ?? {});
        return;
      case 'open_ticket':
        await this.openTicket(ticket);
        return;
      case 'draft_comment':
        if (!action.text?.trim()) return;
        this.intents.setCommentDraft(ticket, action.text);
        await this.openTicket(ticket);
        return;
      case 'upload_attachment':
        this.intents.requestUpload(ticket);
        await this.openTicket(ticket);
        return;
    }
  }

  private async openTicket(ticket: number): Promise<void> {
    if (!Number.isSafeInteger(ticket) || ticket <= 0) return;
    await this.openFull(`/dashboard/tickets/${ticket}`);
  }

  /** Views of `run_action` (`compact`, dashboard sections, a board or a ticket). */
  private async navigate(view: string, params: McpAction['params'] & object): Promise<void> {
    const str = (key: string) => (params[key] === undefined || params[key] === null ? '' : String(params[key]));
    switch (view) {
      case 'compact':
        await this.windowService.setCompactMode();
        return;
      case 'ticket':
        await this.openTicket(Number(str('ticket').replace(/^#/, '')));
        return;
      case 'boards':
        // Boards are listed per project; without one, the project list is the entry point.
        await this.openFull(str('projectId') ? `/dashboard/boards/${encodeURIComponent(str('projectId'))}` : '/dashboard/projects');
        return;
      case 'board':
        if (!str('projectId') || !str('boardId')) return;
        await this.openFull(
          `/dashboard/boards/${encodeURIComponent(str('projectId'))}/${encodeURIComponent(str('boardId'))}`,
        );
        return;
      case 'reports': {
        const query = new URLSearchParams();
        for (const key of ['ticket', 'projectId', 'userId', 'activityId', 'spentOnFrom', 'spentOnTo', 'groupBy']) {
          if (str(key)) query.set(key, str(key));
        }
        const qs = query.toString();
        await this.openFull(`/dashboard/reports${qs ? `?${qs}` : ''}`);
        return;
      }
      case 'settings':
        await this.openFull(str('tab') ? `/dashboard/settings?tab=${encodeURIComponent(str('tab'))}` : '/dashboard/settings');
        return;
      case 'overview':
      case 'time-entries':
      case 'projects':
        await this.openFull(`/dashboard/${view}`);
        return;
    }
  }

  /** Full-mode views: switch mode when needed, otherwise just navigate. */
  private async openFull(url: string): Promise<void> {
    if (this.windowService.viewMode() === 'full') {
      await this.router.navigateByUrl(url);
    } else {
      await this.windowService.setFullMode(url);
    }
  }
}
