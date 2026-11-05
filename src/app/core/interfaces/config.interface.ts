export type ThemeMode = 'system' | 'light' | 'dark';

export type PresetColor = 'indigo' | 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';

export type PrimaryColor = PresetColor | (string & {});

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Lunes, 7 = Domingo

export interface DaySchedule {
  day: DayOfWeek;
  name: string;
  short_name: string;
  enabled: boolean;
  entry_time: string;
  exit_time: string;
  lunch_minutes: number;
}

export interface ScheduleGroup {
  id: string;
  name: string;
  days: DayOfWeek[];
  entry_time: string;
  exit_time: string;
  lunch_minutes: number;
}

export interface WorkScheduleConfig {
  mode: 'group' | 'custom';
  groups: ScheduleGroup[];
  days: DaySchedule[];
}

export type AppLanguage = 'es' | 'en';

export interface AppConfig {
  entry_time: string;
  exit_time: string;
  lunch_minutes: number;
  openproject_url: string;
  openproject_token: string;
  theme_mode: ThemeMode;
  primary_color: PrimaryColor;
  is_configured: boolean;
  language: AppLanguage;
  schedule?: WorkScheduleConfig;
  schedule_json?: string;
  user_name?: string;
  user_login?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  user_name?: string;
  user_login?: string;
  message: string;
}

export function calculateWorkMinutes(entry: string, exit: string, lunch: number): number {
  if (!entry || !exit) return 0;
  const [entryH, entryM] = entry.split(':').map(Number);
  const [exitH, exitM] = exit.split(':').map(Number);

  let totalEntry = (entryH || 0) * 60 + (entryM || 0);
  let totalExit = (exitH || 0) * 60 + (exitM || 0);

  let diff = totalExit - totalEntry;
  if (diff < 0) {
    diff += 24 * 60; // Overnight support
  }

  diff -= lunch || 0;
  return Math.max(0, diff);
}

export function formatWorkMinutes(totalMins: number): string {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export const DEFAULT_DAYS_TEMPLATE: DaySchedule[] = [
  { day: 1, name: 'Lunes', short_name: 'Lun', enabled: true, entry_time: '08:00', exit_time: '17:30', lunch_minutes: 60 },
  { day: 2, name: 'Martes', short_name: 'Mar', enabled: true, entry_time: '08:00', exit_time: '17:30', lunch_minutes: 60 },
  { day: 3, name: 'Miércoles', short_name: 'Mié', enabled: true, entry_time: '08:00', exit_time: '17:30', lunch_minutes: 60 },
  { day: 4, name: 'Jueves', short_name: 'Jue', enabled: true, entry_time: '08:00', exit_time: '17:30', lunch_minutes: 60 },
  { day: 5, name: 'Viernes', short_name: 'Vie', enabled: true, entry_time: '08:00', exit_time: '17:00', lunch_minutes: 60 },
  { day: 6, name: 'Sábado', short_name: 'Sáb', enabled: false, entry_time: '08:00', exit_time: '13:00', lunch_minutes: 0 },
  { day: 7, name: 'Domingo', short_name: 'Dom', enabled: false, entry_time: '08:00', exit_time: '17:00', lunch_minutes: 60 },
];

export const DEFAULT_WORK_SCHEDULE: WorkScheduleConfig = {
  mode: 'group',
  groups: [
    {
      id: 'group-mon-thu',
      name: 'Lunes a Jueves',
      days: [1, 2, 3, 4],
      entry_time: '08:00',
      exit_time: '17:30',
      lunch_minutes: 60,
    },
    {
      id: 'group-fri',
      name: 'Viernes',
      days: [5],
      entry_time: '08:00',
      exit_time: '17:00',
      lunch_minutes: 60,
    },
  ],
  days: DEFAULT_DAYS_TEMPLATE,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  entry_time: '08:00',
  exit_time: '17:30',
  lunch_minutes: 60,
  openproject_url: 'https://openproject.wposs.com/openproject',
  openproject_token: '',
  theme_mode: 'system',
  primary_color: 'violet',
  is_configured: false,
  language: 'es',
  schedule: DEFAULT_WORK_SCHEDULE,
  user_name: '',
  user_login: '',
};
