import { DayOfWeek, PrimaryColor } from '../../../core/interfaces/config.interface';

export interface DayMeta {
  day: DayOfWeek;
  name: string;
  short: string;
}

export interface ColorOption {
  id: PrimaryColor;
  name: string;
  bgClass: string;
  hex: string;
}

export interface ScheduleModeOption {
  label: string;
  value: 'group' | 'custom';
}
