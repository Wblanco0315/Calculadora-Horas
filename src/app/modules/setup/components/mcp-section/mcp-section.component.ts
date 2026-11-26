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
import { ActivityService } from '../../../core/services/activity.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

export type McpClientType = 'quick_setup' | 'antigravity' | 'agy_cli' | 'cursor' | 'claude_desktop' | 'claude_code';

@Component({
  selector: 'app-mcp-section',
  standalone: true,
  imports: [CommonModule, ButtonDirective, Tabs, TabList, Tab, NgIcon, TranslatePipe],
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
  template: `
    <div class="space-y-4">
      <!-- Section Header -->
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
        <div class="flex items-center gap-2">
          <ng-icon name="tablerRobot" size="1.25rem" class="text-primary-600 dark:text-primary-400 shrink-0" />
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
            {{ 'setup.mcp.title' | translate }}
          </h2>
        </div>

      </div>

      <!-- Step 1: Automated Client Setup -->
      <div class="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 space-y-3">
        <div class="space-y-2.5">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            1. {{ 'setup.mcp.clientConfigTitle' | translate }}
          </span>

          <!-- PrimeNG Tabs for Client Selection -->
          <p-tabs [value]="selectedClient()" (valueChange)="selectClient($event)">
            <p-tablist class="w-full flex gap-1 overflow-x-auto border-b border-slate-200/80 dark:border-zinc-800">
              <p-tab value="quick_setup" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientSetupCli' | translate }}
              </p-tab>
              <p-tab value="antigravity" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientAntigravity' | translate }}
              </p-tab>
              <p-tab value="agy_cli" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientAgyCli' | translate }}
              </p-tab>
              <p-tab value="cursor" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientCursor' | translate }}
              </p-tab>
              <p-tab value="claude_desktop" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientClaudeDesktop' | translate }}
              </p-tab>
              <p-tab value="claude_code" class="cursor-pointer py-1.5 px-3 text-xs font-medium">
                {{ 'setup.mcp.clientClaudeCode' | translate }}
              </p-tab>
            </p-tablist>
          </p-tabs>
        </div>

        <!-- Target hint -->
        <p class="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
          {{ currentHintKey() | translate }}
        </p>

        <!-- Action bar: Auto-install or Copy -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2 flex-wrap">
            @if (canAutoInstall()) {
              <button
                pButton
                type="button"
                severity="primary"
                size="small"
                [loading]="isInstalling()"
                (click)="autoInstall()"
                class="!py-1.5 !px-3.5 text-xs font-semibold"
              >
                <ng-icon name="tablerBolt" size="0.95rem" class="mr-1" />
                <span>{{ 'setup.mcp.autoInstall' | translate }}</span>
              </button>
            }

            <button
              pButton
              type="button"
              severity="secondary"
              variant="outlined"
              size="small"
              (click)="copySnippet()"
              class="!py-1.5 !px-3 text-xs font-semibold"
            >
              @if (copiedSnippet()) {
                <ng-icon name="tablerCheck" size="0.85rem" class="mr-1 text-emerald-500" />
                <span>{{ (isCliMode() ? 'setup.mcp.commandCopied' : 'setup.mcp.snippetCopied') | translate }}</span>
              } @else {
                <ng-icon [name]="isCliMode() ? 'tablerTerminal2' : 'tablerCopy'" size="0.85rem" class="mr-1" />
                <span>{{ (isCliMode() ? 'setup.mcp.copyCommand' : 'setup.mcp.copySnippet') | translate }}</span>
              }
            </button>
          </div>

          @if (installFeedback()) {
            <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate">
              <ng-icon name="tablerCheck" size="0.9rem" />
              <span class="truncate">{{ installFeedback() }}</span>
            </span>
          }
        </div>

        <!-- Code/Command Display -->
        <pre class="p-3 rounded-xl bg-slate-900 text-slate-100 dark:bg-zinc-950 border border-slate-800 font-mono text-[11px] leading-relaxed overflow-x-auto select-all max-h-28">{{ currentSnippet() }}</pre>
      </div>

      <!-- Step 2: Agent Rules Automation -->
      <div class="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 space-y-2.5">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <span class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            2. {{ 'setup.mcp.instructionsTitle' | translate }}
          </span>

          <div class="flex items-center gap-2">
            <button
              pButton
              type="button"
              severity="primary"
              size="small"
              [loading]="isInjectingRules()"
              (click)="autoInjectRules()"
              class="!py-1.5 !px-3 text-xs font-semibold"
            >
              <ng-icon name="tablerBolt" size="0.9rem" class="mr-1" />
              <span>{{ 'setup.mcp.autoInjectRules' | translate }}</span>
            </button>

            <button
              pButton
              type="button"
              severity="secondary"
              variant="outlined"
              size="small"
              (click)="copyPrompt()"
              class="!py-1.5 !px-3 text-xs font-semibold"
            >
              @if (copiedPrompt()) {
                <ng-icon name="tablerCheck" size="0.85rem" class="mr-1 text-emerald-500" />
                <span>{{ 'setup.mcp.promptCopied' | translate }}</span>
              } @else {
                <ng-icon name="tablerCopy" size="0.85rem" class="mr-1" />
                <span>{{ 'setup.mcp.copyPrompt' | translate }}</span>
              }
            </button>
          </div>
        </div>

        @if (injectFeedback()) {
          <div class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <ng-icon name="tablerCheck" size="1rem" class="shrink-0" />
            <span class="truncate">{{ injectFeedback() }}</span>
          </div>
        }

        <!-- Collapsible Rules Preview -->
        <div>
          <button
            type="button"
            (click)="showPromptDetails.set(!showPromptDetails())"
            class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            @if (showPromptDetails()) {
              <ng-icon name="tablerChevronUp" size="0.85rem" />
              <span>{{ 'setup.mcp.hidePromptDetails' | translate }}</span>
            } @else {
              <ng-icon name="tablerChevronDown" size="0.85rem" />
              <span>{{ 'setup.mcp.showPromptDetails' | translate }}</span>
            }
          </button>

          @if (showPromptDetails()) {
            <div class="mt-2 font-mono text-[11px] bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 whitespace-pre-wrap select-all max-h-56 overflow-y-auto leading-relaxed text-slate-700 dark:text-zinc-300">
              {{ aiSystemPrompt }}
            </div>
          }
        </div>
      </div>


    </div>
  `,
})
export class McpSectionComponent implements OnInit {
  private readonly activityService = inject(ActivityService);

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

  readonly aiSystemPrompt = `# Instrucciones de Integración: PocketProject Time Tracker (MCP)

Eres un asistente de ingeniería de software conectado a PocketProject vía Model Context Protocol (MCP).
Tu objetivo es registrar y gestionar de forma proactiva, exacta y profesional el tiempo dedicado a las tareas.

### 1. Interpretación de Términos Comunes:
- "Necesito llenar el ticket 11111", "Cargar horas a 11111", "Imputar tiempo en 11111", "Trabajé en el ticket 11111" -> Significa registrar una actividad ('add_activity') asociada al ticket 11111 tras verificar su contexto.
- "Empezar con el ticket 11111" -> Iniciar el cronómetro con 'start_timer'.
- "¿Cómo voy hoy?" o "Resumen de horas" -> 'get_today_summary'.
- "¿Qué registré en el ticket 11111?" -> 'get_ticket_context(ticket: "11111", include_time_entries: true)' o 'search_activities'.
- "¿Quién soy?", "Información de mi usuario" -> 'get_user_info'.
- "Listar proyectos", "Ver proyectos" -> 'get_projects'.
- "Listar estados", "¿Cuáles son los estados?" -> 'get_statuses'.
- "Cambiar estado del ticket 11111 a [estado]" -> 'update_ticket_status'.
- "Ver tableros del proyecto", "Columnas del tablero" -> 'get_project_boards' / 'get_board_columns'.
- "Mover ticket 11111 a la columna [columna]" -> 'move_ticket_column'.

### 2. Protocolo Estricto de Tickets (ANTI-ALUCINACIÓN):
- PROHIBIDO INVENTAR NÚMEROS DE TICKET: Jamás asumas o inventes un ticket que el usuario no haya escrito textualmente.
- Si no hay ticket, el campo debe ser omitido o null.
- Si el usuario menciona un ticket (ej. 11111):
  1. Ejecuta PRIMERO 'get_ticket_context(ticket: "11111")' (resolución en cascada: Favoritos/Historial local -> OpenProject API en vivo).
  2. Si 'found: true': Utiliza el título oficial ('subject') y proyecto recuperados para registrar la actividad ('add_activity') o cronómetro ('start_timer').
  3. Si 'found: false': PREGUNTA AL USUARIO:
     "No encontré el ticket #11111 en OpenProject ni en favoritos. ¿El Project Manager o encargado ya creó este ticket en el sistema?"
     - Si indica que aún no está creado: registra la actividad con ticket null y descripción profesional, marcando que queda pendiente de ticket.
     - Si corrige el número: repite la consulta con el nuevo número.

### 3. Herramientas MCP Disponibles:
1. get_today_summary: Balance del día (horas trabajadas, meta, minutos restantes).
2. get_ticket_context: Resolución del ticket (título, proyecto, estado, prioridad, asignado, descripción). Banderas: 'include_description' (def: true), 'include_comments' (def: false), 'include_attachments' (def: false), 'include_time_entries' (def: false).
3. get_ticket_attachment: Descarga y retorna contenido de un archivo/adjunto o imagen. (OBLIGATORIO pedir permiso al usuario).
4. search_activities: Búsqueda profunda en historial por ticket, descripción o rango de fechas.
5. search_tickets: Búsqueda unificada en favoritos, historial y OpenProject en vivo.
6. get_activities: Lista actividades registradas en una fecha.
7. add_activity: Registra una actividad (autocompleta desde OpenProject o favoritos).
8. edit_activity: Actualiza descripción, minutos o ticket de una actividad existente.
9. start_timer: Inicia cronómetro para una tarea activa (pausa el anterior).
10. stop_timer: Detiene cronómetro activo y consolida minutos.
11. get_favorite_tickets: Lista tickets favoritos con título y proyecto.
12. add_favorite_ticket: Guarda un ticket frecuente en favoritos.
13. get_openproject_context: Información del usuario y configuración OpenProject.
14. get_user_info: Perfil completo del usuario OpenProject autenticado.
15. get_projects: Lista y búsqueda de proyectos de OpenProject.
16. get_statuses: Lista oficial de estados de OpenProject.
17. update_ticket_status: Actualiza el estado de un ticket en OpenProject.
18. get_project_boards / get_board_columns: Consulta tableros Kanban y columnas de un proyecto.
19. move_ticket_column: Mueve un ticket de columna en un tablero y sincroniza su estado.

### 4. Lectura Progresiva de Contexto y Permisos de Archivos:
- **Lectura Normal de Descripción**: Al consultar un ticket con 'get_ticket_context(ticket: "11111")', el servidor retorna por defecto la descripción del ticket ('include_description: true'). Lee y comprende la descripción para contextualizar la tarea.
- **Sugerir Lectura de Comentarios**: Tras leer la descripción, sugiere proactivamente al usuario si desea que consultes también los comentarios o notas del ticket:
  *"He leído la descripción del ticket. ¿Deseas que revise los comentarios para obtener más detalles?"*
  - Si el usuario lo autoriza o lo pide, ejecuta 'get_ticket_context(ticket: "11111", include_comments: true)'.
- **Permisos Obligatorios para Archivos y Adjuntos**:
  - Si el ticket tiene archivos adjuntos o imágenes ('include_attachments: true'), o si necesitas inspeccionar un archivo adjunto con 'get_ticket_attachment':
  - **NUNCA descargues ni abras un archivo sin el consentimiento explícito del usuario**.
  - Pide permiso explícito: *"El ticket contiene el archivo adjunto [nombre]. ¿Me autorizas a descargarlo y revisar su contenido?"*
  - Solo tras la confirmación afirmativa del usuario, ejecuta 'get_ticket_attachment(download_url: "...")'.

### 5. Flujo de Trabajo y Ciclo de Vida del Ticket (Estados y Tableros):
- **Roles**: El PM crea o se le solicita el ticket. El Responsable supervisa y el Asignado implementa y solventa la tarea.
- **Inicio y Borrador para el PM**: Al iniciar, si el usuario no tiene número de ticket, pedirle el número o indicarle que lo solicite al PM. Si se le va a pedir al PM, el agente debe ofrecer generarle el borrador en texto con el formato estructurado (Nombre de ticket, Descripción, Tiempo, Fecha Inicio y Fin).
- **Comprobación de Columnas Reales**: El agente DEBE SIEMPRE extraer y verificar las columnas reales del tablero ('get_board_columns') antes de intentar mover un ticket, sin asumir nombres fijos sin contrastar.
- **En Desarrollo**: Al trabajar en la tarea, colocar en estado "En desarrollo" y mover a columna real correspondiente ("HACER HOY" o "EN CURSO", consultando al usuario cuál prefiere).
- **Justificado**: Si el problema no tiene solución técnica viable o es el comportamiento esperado del sistema, estado "Justificado".
- **Bloqueo / Dependencia**: Si depende de otra tarea para avanzar, estado "En espera" y columna "BLOQUEANTE".
- **Terminado**: Al finalizar el desarrollo, estado "Desarrollado" y columna "DESARROLLADO".
- **Prueba Fallida**: Si el ticket está en "Prueba fallida", la solución anterior falló. Investigar leyendo descripción, comentarios y archivos (con permiso).
- **Cierre / Producción**: Tras superar QA y desplegar a producción sin problemas, el PM o el asignado delegado pasan a estado "Cerrado" y columna "FINALIZADO".
- **Confirmación Obligatoria**: Ante cualquier duda o transición, PREGUNTAR SIEMPRE al usuario mostrando las opciones disponibles. NUNCA cambiar estados ni mover columnas sin autorización expresa.`;

  async ngOnInit(): Promise<void> {
    const path = await this.activityService.getDatabasePath();
    this.dbPath.set(path);

    const count = await this.activityService.getAiStats();
    this.aiActivitiesCount.set(count);
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
        return `npx -y pocketproject-mcp setup`;

      case 'antigravity':
        return JSON.stringify(
          {
            mcpServers: {
              pocketproject: {
                command: 'npx',
                args: ['-y', 'pocketproject-mcp'],
              },
            },
          },
          null,
          2
        );

      case 'agy_cli':
        return `agy mcp add pocketproject -- npx -y pocketproject-mcp`;

      case 'cursor':
        return JSON.stringify(
          {
            mcpServers: {
              pocketproject: {
                command: 'npx',
                args: ['-y', 'pocketproject-mcp'],
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
                args: ['-y', 'pocketproject-mcp'],
              },
            },
          },
          null,
          2
        );

      case 'claude_code':
        return `claude mcp add -s user pocketproject -- npx -y pocketproject-mcp`;
    }
  }

  async autoInstall(): Promise<void> {
    const client = this.selectedClient();
    this.isInstalling.set(true);
    this.installFeedback.set(null);

    try {
      const res = await this.activityService.installMcpToClient(client);
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
    this.isInjectingRules.set(true);
    this.injectFeedback.set(null);

    try {
      const res = await this.activityService.injectAiRules();
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
      await navigator.clipboard.writeText(this.aiSystemPrompt);
      this.copiedPrompt.set(true);
      setTimeout(() => this.copiedPrompt.set(false), 2000);
    } catch {}
  }
}
