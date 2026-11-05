import { StatusOption } from './openproject.interface';

export * from './openproject.interface';

export interface Activity {
  id: string;
  name: string;
  minutes: number;
  seconds?: number;
  date: string; // YYYY-MM-DD
  projectId?: string;
  project_id?: string;
  projectName?: string;
  project_name?: string;
  ticket?: string;
  ticketTitle?: string;
  ticket_title?: string;
  statusId?: string;
  status_id?: string;
  statusName?: string;
  status_name?: string;
  statusColor?: string;
  status_color?: string;
  availableStatuses?: StatusOption[];
  versionId?: string;
  version_id?: string;
  versionName?: string;
  version_name?: string;
  boardId?: string;
  board_id?: string;
  boardColumnId?: string;
  board_column_id?: string;
  boardColumnName?: string;
  board_column_name?: string;
  synced?: boolean;
  selected?: boolean;
  isSyncing?: boolean;
  syncSuccess?: boolean;
  syncError?: boolean;
  timerSeconds?: number;
  timer_seconds?: number;
  timerState?: 'idle' | 'running' | 'paused';
  timer_state?: 'idle' | 'running' | 'paused';
  timerLastStarted?: number;
  timer_last_started?: number;
  activityTypeId?: string;
  activity_type_id?: string;
  activityTypeName?: string;
  activity_type_name?: string;
  createdAt?: string;
  created_at?: string;
}

export interface FavoriteTicket {
  ticket: string;
  title: string;
  projectId?: string;
  projectName?: string;
}
