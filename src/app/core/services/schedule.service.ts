import { Injectable, computed, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';
import { LanguageService } from './language.service';
import {
  AppConfig,
  DayOfWeek,
  DaySchedule,
  ScheduleGroup,
  WorkScheduleConfig,
  calculateWorkMinutes,
  formatWorkMinutes,
  DEFAULT_DAYS_TEMPLATE,
  DEFAULT_WORK_SCHEDULE,
} from '../interfaces/config.interface';

export interface DayMeta {
  day: DayOfWeek;
  name: string;
  short: string;
}

@Injectable({
  providedIn: 'root',
})
export class ScheduleService {
  private readonly storageService = inject(StorageService);
  readonly languageService = inject(LanguageService);

  // Draft inputs for creating or updating a schedule rule
  readonly draftDays = signal<DayOfWeek[]>([1, 2, 3, 4]);
  readonly draftEntryTime = signal<string>('08:00');
  readonly draftExitTime = signal<string>('17:30');

  // Schedule core state
  readonly scheduleMode = signal<'group' | 'custom'>('group');
  readonly scheduleGroups = signal<ScheduleGroup[]>(
    JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE.groups))
  );
  readonly scheduleDays = signal<DaySchedule[]>(
    JSON.parse(JSON.stringify(DEFAULT_DAYS_TEMPLATE))
  );
  readonly lunchMinutes = signal<number>(60);
  readonly isSaving = signal<boolean>(false);

  readonly allDaysMeta: DayMeta[] = [
    { day: 1, name: 'Lunes', short: 'Lun' },
    { day: 2, name: 'Martes', short: 'Mar' },
    { day: 3, name: 'Miércoles', short: 'Mié' },
    { day: 4, name: 'Jueves', short: 'Jue' },
    { day: 5, name: 'Viernes', short: 'Vie' },
    { day: 6, name: 'Sábado', short: 'Sáb' },
    { day: 7, name: 'Domingo', short: 'Dom' },
  ];

  getDayKey(day: DayOfWeek): string {
    const map: Record<DayOfWeek, string> = {
      1: 'days.monday',
      2: 'days.tuesday',
      3: 'days.wednesday',
      4: 'days.thursday',
      5: 'days.friday',
      6: 'days.saturday',
      7: 'days.sunday',
    };
    return map[day] || '';
  }

  getDayName(day: DayOfWeek): string {
    const key = this.getDayKey(day);
    return key ? this.languageService.t(key) : '';
  }

  getDayLetter(day: DayOfWeek): string {
    const isEn = this.languageService.currentLang() === 'en';
    const lettersEn: Record<DayOfWeek, string> = { 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S' };
    const lettersEs: Record<DayOfWeek, string> = { 1: 'L', 2: 'M', 3: 'M', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
    return isEn ? lettersEn[day] : lettersEs[day];
  }

  readonly weekDaysDisplay = computed(() => {
    this.languageService.currentLang();
    const order: DayOfWeek[] = [7, 1, 2, 3, 4, 5, 6];
    return order.map((day) => ({
      day,
      letter: this.getDayLetter(day),
      name: this.getDayName(day),
    }));
  });

  readonly enabledDays = computed(() => {
    return this.scheduleDays().filter((d) => d.enabled);
  });

  readonly totalWeeklyMinutes = computed(() => {
    return this.scheduleDays()
      .filter((d) => d.enabled)
      .reduce((sum, d) => sum + calculateWorkMinutes(d.entry_time, d.exit_time, d.lunch_minutes), 0);
  });

  readonly formattedWeeklyHours = computed(() => {
    const total = this.totalWeeklyMinutes();
    return formatWorkMinutes(total);
  });

  readonly workingDaysCount = computed(() => {
    return this.enabledDays().length;
  });

  readonly isScheduleValid = computed(() => {
    return this.workingDaysCount() > 0 && this.totalWeeklyMinutes() > 0;
  });

  readonly unassignedDays = computed(() => {
    const assignedDays = new Set<DayOfWeek>();
    for (const grp of this.scheduleGroups()) {
      for (const d of grp.days) {
        assignedDays.add(d);
      }
    }
    return this.allDaysMeta.filter((d) => !assignedDays.has(d.day));
  });

  formatTime12h(time24: string): string {
    if (!time24) return '--:--';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h)) return time24;
    const isEn = this.languageService.currentLang() === 'en';
    const period = h >= 12 ? (isEn ? 'PM' : 'p.m.') : (isEn ? 'AM' : 'a.m.');
    h = h % 12;
    if (h === 0) h = 12;
    const minsFormatted = isNaN(m) ? '00' : m.toString().padStart(2, '0');
    return `${h}:${minsFormatted} ${period}`;
  }

  formatDaysGroupFullName(days: DayOfWeek[]): string {
    if (!days || days.length === 0) return '';
    const sorted = [...days].sort((a, b) => a - b);
    const toWord = this.languageService.t('days.to');

    if (sorted.length === 1) {
      return this.getDayName(sorted[0]);
    }
    const isConsecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    if (isConsecutive && sorted.length > 1) {
      return `${this.getDayName(sorted[0])} ${toWord} ${this.getDayName(sorted[sorted.length - 1])}`;
    }
    return sorted.map((d) => this.getDayName(d)).join(', ');
  }

  getGroupDisplayName(group: ScheduleGroup): string {
    this.languageService.currentLang();
    if (group.days && group.days.length > 0) {
      return this.formatDaysGroupFullName(group.days);
    }
    return group.name;
  }

  toggleDraftDay(day: DayOfWeek): void {
    const current = this.draftDays();
    if (current.includes(day)) {
      this.draftDays.set(current.filter((d) => d !== day));
    } else {
      this.draftDays.set([...current, day].sort((a, b) => a - b));
    }
  }

  isDraftDayActive(day: DayOfWeek): boolean {
    return this.draftDays().includes(day);
  }

  setDraftEntryTime(time: string): void {
    this.draftEntryTime.set(time);
  }

  setDraftExitTime(time: string): void {
    this.draftExitTime.set(time);
  }

  saveDraftRule(): void {
    const days = this.draftDays();
    if (days.length === 0) return;

    const entry = this.draftEntryTime();
    const exit = this.draftExitTime();
    const lunch = this.lunchMinutes();
    const name = this.formatDaysGroupFullName(days);

    // Remove any overlapping days from existing groups
    const cleanedGroups = this.scheduleGroups()
      .map((g) => ({
        ...g,
        days: g.days.filter((d: DayOfWeek) => !days.includes(d)),
      }))
      .filter((g) => g.days.length > 0);

    const newGroup: ScheduleGroup = {
      id: `group-${Date.now()}`,
      name,
      days: [...days].sort((a, b) => a - b),
      entry_time: entry,
      exit_time: exit,
      lunch_minutes: lunch,
    };

    const updated = [...cleanedGroups, newGroup];
    this.scheduleGroups.set(updated);
    this.syncDaysFromGroups(updated);

    // Auto-select remaining unassigned days if any
    const unassigned = this.unassignedDays();
    if (unassigned.length > 0) {
      this.draftDays.set([unassigned[0].day]);
      if (unassigned[0].day === 5) {
        this.draftEntryTime.set('08:00');
        this.draftExitTime.set('17:00');
      }
    } else {
      this.draftDays.set([]);
    }
  }

  removeRule(groupId: string): void {
    const updated = this.scheduleGroups().filter((g) => g.id !== groupId);
    this.scheduleGroups.set(updated);
    this.syncDaysFromGroups(updated);
  }

  editRule(group: ScheduleGroup): void {
    this.draftDays.set([...group.days]);
    this.draftEntryTime.set(group.entry_time);
    this.draftExitTime.set(group.exit_time);
  }

  setLunchMinutes(mins: number): void {
    this.lunchMinutes.set(mins);
    const groups = this.scheduleGroups().map((g) => ({
      ...g,
      lunch_minutes: mins,
    }));
    this.scheduleGroups.set(groups);
    this.syncDaysFromGroups(groups);
  }

  syncDaysFromGroups(groups: ScheduleGroup[]): void {
    const assignedMap = new Map<DayOfWeek, ScheduleGroup>();

    for (const g of groups) {
      for (const d of g.days) {
        assignedMap.set(d, g);
      }
    }

    const updated = DEFAULT_DAYS_TEMPLATE.map((tpl) => {
      const assignedGroup = assignedMap.get(tpl.day);
      const dayName = this.getDayName(tpl.day) || tpl.name;
      if (assignedGroup) {
        return {
          ...tpl,
          name: dayName,
          enabled: true,
          entry_time: assignedGroup.entry_time,
          exit_time: assignedGroup.exit_time,
          lunch_minutes: assignedGroup.lunch_minutes,
        };
      } else {
        return {
          ...tpl,
          name: dayName,
          enabled: false,
        };
      }
    });

    this.scheduleDays.set(updated);
  }

  initFromConfig(config: AppConfig | null): void {
    if (!config) {
      this.scheduleGroups.set(JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE.groups)));
      this.syncDaysFromGroups(this.scheduleGroups());
      this.lunchMinutes.set(60);
      return;
    }

    if (config.lunch_minutes !== undefined) {
      this.lunchMinutes.set(config.lunch_minutes);
    }

    if (config.schedule?.groups && config.schedule.groups.length > 0) {
      this.scheduleGroups.set(JSON.parse(JSON.stringify(config.schedule.groups)));
      this.syncDaysFromGroups(config.schedule.groups);
    } else if (config.schedule?.days) {
      this.scheduleDays.set(JSON.parse(JSON.stringify(config.schedule.days)));
    } else {
      this.syncDaysFromGroups(this.scheduleGroups());
    }

    // Initialize draft values
    this.draftDays.set([1, 2, 3, 4]);
    this.draftEntryTime.set(config.entry_time || '08:00');
    this.draftExitTime.set(config.exit_time || '17:30');
  }

  resetFromCurrentConfig(): void {
    const current = this.storageService.config();
    this.initFromConfig(current);
  }

  async saveSchedule(): Promise<void> {
    this.isSaving.set(true);
    const currentConfig = this.storageService.config();
    const scheduleConfig: WorkScheduleConfig = {
      mode: this.scheduleMode(),
      groups: this.scheduleGroups(),
      days: this.scheduleDays(),
    };

    const primaryDay = this.scheduleDays().find((d) => d.enabled) || this.scheduleDays()[0];

    const configToSave: AppConfig = {
      ...currentConfig,
      entry_time: primaryDay ? primaryDay.entry_time : currentConfig.entry_time,
      exit_time: primaryDay ? primaryDay.exit_time : currentConfig.exit_time,
      lunch_minutes: this.lunchMinutes(),
      schedule: scheduleConfig,
    };

    try {
      await this.storageService.saveConfig(configToSave);
    } catch (err) {
      console.error('Error saving schedule config:', err);
      throw err;
    } finally {
      this.isSaving.set(false);
    }
  }
}
