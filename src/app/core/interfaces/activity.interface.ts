export interface Project {
  id: string;
  name: string;
  identifier?: string;
}

export interface StatusOption {
  id: string;
  name: string;
  color?: string;
}

export interface Activity {
  id: string;
  name: string;
  minutes: number;
  seconds?: number;
  date: string; // YYYY-MM-DD
  projectId?: string;
  projectName?: string;
  ticket?: string;
  ticketTitle?: string;
  statusId?: string;
  statusName?: string;
  statusColor?: string;
  versionId?: string;
  versionName?: string;
  boardId?: string;
  boardColumnId?: string;
  boardColumnName?: string;
  synced?: boolean;
  selected?: boolean;
  isSyncing?: boolean;
  syncSuccess?: boolean;
  syncError?: boolean;
  timerSeconds?: number;
  timerState?: 'idle' | 'running' | 'paused';
  timerLastStarted?: number;
  createdAt?: string;
}

export interface TimeEntryActivityType {
  id: string;
  name: string;
}

export interface FavoriteTicket {
  ticket: string;
  title: string;
  projectId?: string;
  projectName?: string;
}

export interface TicketInfoResult {
  success: boolean;
  subject?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  status_id?: string | null;
  status_name?: string | null;
  status_color?: string | null;
  message: string;
}
