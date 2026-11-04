import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from '../../../core/services/storage.service';
import { ThemeService } from '../../../core/services/theme.service';
import { LanguageService } from '../../../core/services/language.service';
import { ScheduleService } from '../../../core/services/schedule.service';
import {
  AppConfig,
  AppLanguage,
  ConnectionTestResult,
  PrimaryColor,
  ThemeMode,
  DayOfWeek,
  DaySchedule,
  ScheduleGroup,
  WorkScheduleConfig,
  calculateWorkMinutes,
  formatWorkMinutes,
  DEFAULT_DAYS_TEMPLATE,
  DEFAULT_WORK_SCHEDULE,
} from '../../../core/interfaces/config.interface';
import { ColorOption, DayMeta, ScheduleModeOption } from '../interfaces/setup.interface';

@Injectable({
  providedIn: 'root',
})
export class SetupService {
  private readonly storageService = inject(StorageService);
  private readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);
  readonly scheduleService = inject(ScheduleService);
  private readonly router = inject(Router);

  // Stepper State
  readonly activeStep = signal<number>(1);

  // Schedule State Delegated to ScheduleService
  readonly draftDays = this.scheduleService.draftDays;
  readonly draftEntryTime = this.scheduleService.draftEntryTime;
  readonly draftExitTime = this.scheduleService.draftExitTime;

  // Step 1: Simplified Schedule State (Alarm / Google Clock style)
  readonly entryTime = signal<string>('08:00');
  readonly exitTime = signal<string>('17:30');
  readonly lunchMinutes = this.scheduleService.lunchMinutes;
  readonly activeDays = signal<DayOfWeek[]>([1, 2, 3, 4, 5]);

  getDayName(day: DayOfWeek): string {
    return this.scheduleService.getDayName(day);
  }

  getDayLetter(day: DayOfWeek): string {
    return this.scheduleService.getDayLetter(day);
  }

  readonly weekDaysDisplay = this.scheduleService.weekDaysDisplay;
  readonly scheduleMode = this.scheduleService.scheduleMode;
  readonly scheduleGroups = this.scheduleService.scheduleGroups;
  readonly scheduleDays = this.scheduleService.scheduleDays;

  readonly scheduleModeOptions: ScheduleModeOption[] = [
    { label: 'Agrupado por Días', value: 'group' },
    { label: 'Día por Día', value: 'custom' },
  ];

  readonly allDaysMeta: DayMeta[] = this.scheduleService.allDaysMeta;

  // Step 2: Appearance & Language State
  readonly themeMode = signal<ThemeMode>('system');
  readonly primaryColor = signal<PrimaryColor>('violet');
  readonly language = signal<AppLanguage>(this.languageService.currentLang());

  readonly availableColors: ColorOption[] = [
    { id: 'violet', name: 'Violeta', bgClass: 'bg-violet-600', hex: '#5E4DA2' },
    { id: 'indigo', name: 'Índigo', bgClass: 'bg-indigo-500', hex: '#4F46E5' },
    { id: 'blue', name: 'Azul', bgClass: 'bg-blue-500', hex: '#2563EB' },
    { id: 'emerald', name: 'Esmeralda', bgClass: 'bg-emerald-500', hex: '#059669' },
    { id: 'amber', name: 'Ámbar', bgClass: 'bg-amber-500', hex: '#D97706' },
    { id: 'rose', name: 'Rosa', bgClass: 'bg-rose-500', hex: '#E11D48' },
  ];

  // Step 3: OpenProject API State
  readonly openprojectUrl = signal<string>('https://openproject.wposs.com/openproject');
  readonly openprojectToken = signal<string>('');
  readonly showToken = signal<boolean>(false);
  readonly isTestingConnection = signal<boolean>(false);
  readonly testResult = signal<ConnectionTestResult | null>(null);

  // General State
  readonly isSaving = signal<boolean>(false);

  // Computed Summaries Delegated
  readonly enabledDays = this.scheduleService.enabledDays;
  readonly totalWeeklyMinutes = this.scheduleService.totalWeeklyMinutes;
  readonly formattedWeeklyHours = this.scheduleService.formattedWeeklyHours;
  readonly workingDaysCount = this.scheduleService.workingDaysCount;
  readonly isScheduleValid = this.scheduleService.isScheduleValid;
  readonly unassignedDays = this.scheduleService.unassignedDays;

  formatTime12h(time24: string): string {
    return this.scheduleService.formatTime12h(time24);
  }

  formatDaysGroupBadge(days: DayOfWeek[]): string {
    return this.scheduleService.getDayLetter(days[0]);
  }

  formatDaysGroupFullName(days: DayOfWeek[]): string {
    return this.scheduleService.formatDaysGroupFullName(days);
  }

  getGroupDisplayName(group: ScheduleGroup): string {
    return this.scheduleService.getGroupDisplayName(group);
  }

  toggleDraftDay(day: DayOfWeek): void {
    this.scheduleService.toggleDraftDay(day);
  }

  isDraftDayActive(day: DayOfWeek): boolean {
    return this.scheduleService.isDraftDayActive(day);
  }

  setDraftEntryTime(time: string): void {
    this.scheduleService.setDraftEntryTime(time);
  }

  setDraftExitTime(time: string): void {
    this.scheduleService.setDraftExitTime(time);
  }

  saveDraftRule(): void {
    this.scheduleService.saveDraftRule();
  }

  removeRule(groupId: string): void {
    this.scheduleService.removeRule(groupId);
  }

  editRule(group: ScheduleGroup): void {
    this.scheduleService.editRule(group);
  }

  toggleActiveDay(day: DayOfWeek): void {
    const current = this.activeDays();
    if (current.includes(day)) {
      this.activeDays.set(current.filter((d) => d !== day));
    } else {
      this.activeDays.set([...current, day].sort((a, b) => a - b));
    }
    this.syncScheduleDays();
  }

  setEntryTime(time: string): void {
    this.entryTime.set(time);
    this.syncScheduleDays();
  }

  setExitTime(time: string): void {
    this.exitTime.set(time);
    this.syncScheduleDays();
  }

  setLunchMinutes(mins: number): void {
    this.scheduleService.setLunchMinutes(mins);
  }

  syncDaysFromGroups(groups: ScheduleGroup[]): void {
    this.scheduleService.syncDaysFromGroups(groups);
  }

  syncScheduleDays(): void {
    const active = this.activeDays();
    const entry = this.entryTime();
    const exit = this.exitTime();
    const lunch = this.lunchMinutes();

    const updated: DaySchedule[] = DEFAULT_DAYS_TEMPLATE.map((tpl: DaySchedule) => ({
      ...tpl,
      name: this.scheduleService.getDayName(tpl.day) || tpl.name,
      enabled: active.includes(tpl.day),
      entry_time: entry,
      exit_time: exit,
      lunch_minutes: lunch,
    }));

    this.scheduleDays.set(updated);
  }

  async init(): Promise<void> {
    const existing = await this.storageService.loadConfig();
    if (existing) {
      if (existing.entry_time) this.entryTime.set(existing.entry_time);
      if (existing.exit_time) this.exitTime.set(existing.exit_time);
      this.scheduleService.initFromConfig(existing);

      this.themeMode.set(existing.theme_mode || 'system');
      this.primaryColor.set(existing.primary_color || 'violet');
      if (existing.language) {
        this.language.set(existing.language);
        this.languageService.setLanguage(existing.language);
      }
      if (existing.openproject_url) {
        this.openprojectUrl.set(existing.openproject_url);
      }
      if (existing.openproject_token) {
        this.openprojectToken.set(existing.openproject_token);
      }
    } else {
      this.scheduleService.initFromConfig(null);
      this.syncScheduleDays();
    }
  }

  async saveSchedule(): Promise<void> {
    await this.scheduleService.saveSchedule();
  }

  resetScheduleFromCurrentConfig(): void {
    this.scheduleService.resetFromCurrentConfig();
  }

  selectLanguage(lang: AppLanguage): void {
    this.language.set(lang);
    this.languageService.setLanguage(lang);
  }

  goToStep(step: number | string | undefined): void {
    if (step !== undefined) {
      const num = Number(step);
      if (!isNaN(num)) {
        this.activeStep.set(num);
      }
    }
  }

  setScheduleMode(mode: 'group' | 'custom'): void {
    this.scheduleMode.set(mode);
  }

  toggleDayInGroup(groupId: string, day: DayOfWeek): void {
    const groups = this.scheduleGroups().map((g) => ({
      ...g,
      days: [...g.days],
    }));

    const targetGroup = groups.find((g) => g.id === groupId);
    if (!targetGroup) return;

    const isAlreadyInGroup = targetGroup.days.includes(day);

    if (isAlreadyInGroup) {
      targetGroup.days = targetGroup.days.filter((d: DayOfWeek) => d !== day);
    } else {
      for (const g of groups) {
        g.days = g.days.filter((d: DayOfWeek) => d !== day);
      }
      targetGroup.days.push(day);
      targetGroup.days.sort((a: DayOfWeek, b: DayOfWeek) => a - b);
    }

    this.scheduleGroups.set(groups);
    this.syncDaysFromGroups(groups);
  }

  isDayInGroup(groupId: string, day: DayOfWeek): boolean {
    const grp = this.scheduleGroups().find((g) => g.id === groupId);
    return grp ? grp.days.includes(day) : false;
  }

  updateGroupTime(
    groupId: string,
    field: 'entry_time' | 'exit_time' | 'lunch_minutes',
    value: string | number
  ): void {
    const groups = this.scheduleGroups().map((g) => {
      if (g.id === groupId) {
        return {
          ...g,
          [field]: field === 'lunch_minutes' ? Number(value) || 0 : value,
        };
      }
      return g;
    });

    this.scheduleGroups.set(groups);
    this.syncDaysFromGroups(groups);
  }

  updateGroupName(groupId: string, name: string): void {
    const groups = this.scheduleGroups().map((g) => {
      if (g.id === groupId) {
        return { ...g, name };
      }
      return g;
    });
    this.scheduleGroups.set(groups);
  }

  addGroup(): void {
    const current = this.scheduleGroups();
    const newId = `group-${Date.now()}`;
    const unassigned = this.unassignedDays();
    const defaultDays = unassigned.length > 0 ? [unassigned[0].day] : [];

    const newGroup: ScheduleGroup = {
      id: newId,
      name: `Grupo ${current.length + 1}`,
      days: defaultDays,
      entry_time: '08:00',
      exit_time: '17:00',
      lunch_minutes: 60,
    };

    const updated = [...current, newGroup];
    this.scheduleGroups.set(updated);
    this.syncDaysFromGroups(updated);
  }

  removeGroup(groupId: string): void {
    const current = this.scheduleGroups();
    if (current.length <= 1) return;

    const updated = current.filter((g) => g.id !== groupId);
    this.scheduleGroups.set(updated);
    this.syncDaysFromGroups(updated);
  }

  toggleDayEnabled(dayNum: DayOfWeek): void {
    const days = this.scheduleDays().map((d) => {
      if (d.day === dayNum) {
        return { ...d, enabled: !d.enabled };
      }
      return d;
    });
    this.scheduleDays.set(days);
  }

  updateDayTime(
    dayNum: DayOfWeek,
    field: 'entry_time' | 'exit_time' | 'lunch_minutes',
    value: string | number
  ): void {
    const days = this.scheduleDays().map((d) => {
      if (d.day === dayNum) {
        return {
          ...d,
          [field]: field === 'lunch_minutes' ? Number(value) || 0 : value,
        };
      }
      return d;
    });
    this.scheduleDays.set(days);
  }

  calculateDayMinutes(day: DaySchedule): number {
    if (!day.enabled) return 0;
    return calculateWorkMinutes(day.entry_time, day.exit_time, day.lunch_minutes);
  }

  formatDayMinutes(day: DaySchedule): string {
    const mins = this.calculateDayMinutes(day);
    return formatWorkMinutes(mins);
  }

  calculateGroupMinutes(group: ScheduleGroup): number {
    return calculateWorkMinutes(group.entry_time, group.exit_time, group.lunch_minutes);
  }

  formatGroupMinutes(group: ScheduleGroup): string {
    return formatWorkMinutes(this.calculateGroupMinutes(group));
  }

  selectTheme(mode: ThemeMode): void {
    this.themeMode.set(mode);
    this.themeService.setTheme(mode);
  }

  selectColor(color: PrimaryColor): void {
    this.primaryColor.set(color);
    this.themeService.setPrimaryColor(color);
  }

  setOpenprojectUrl(url: string): void {
    this.openprojectUrl.set(url);
  }

  setOpenprojectToken(token: string): void {
    this.openprojectToken.set(token);
  }

  toggleShowToken(): void {
    this.showToken.update((prev) => !prev);
  }

  async testConnection(): Promise<void> {
    const token = this.openprojectToken().trim();
    const url = this.openprojectUrl().trim();

    if (!token) {
      this.testResult.set({
        success: false,
        message: this.languageService.t('setup.openproject.enterTokenError'),
      });
      return;
    }

    this.isTestingConnection.set(true);
    this.testResult.set(null);

    try {
      const result = await this.storageService.testConnection(url, token);
      this.testResult.set(result);
    } catch (err) {
      this.testResult.set({
        success: false,
        message: this.languageService.t('setup.openproject.testConnectionFailed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      });
    } finally {
      this.isTestingConnection.set(false);
    }
  }

  async completeSetup(): Promise<void> {
    this.isSaving.set(true);

    const scheduleConfig: WorkScheduleConfig = {
      mode: this.scheduleMode(),
      groups: this.scheduleGroups(),
      days: this.scheduleDays(),
    };

    const primaryDay = this.scheduleDays().find((d) => d.enabled) || this.scheduleDays()[0];

    const configToSave: AppConfig = {
      entry_time: primaryDay.entry_time,
      exit_time: primaryDay.exit_time,
      lunch_minutes: primaryDay.lunch_minutes,
      openproject_url: this.openprojectUrl().trim(),
      openproject_token: this.openprojectToken().trim(),
      theme_mode: this.themeService.themeMode(),
      primary_color: this.themeService.primaryColor(),
      language: this.languageService.currentLang(),
      is_configured: true,
      schedule: scheduleConfig,
      user_name: this.testResult()?.user_name || this.storageService.config().user_name || '',
      user_login: this.testResult()?.user_login || this.storageService.config().user_login || '',
    };

    try {
      await this.storageService.saveConfig(configToSave);
      this.themeService.setTheme(configToSave.theme_mode);
      this.themeService.setPrimaryColor(configToSave.primary_color);
      await this.router.navigate(['/compact']);
    } catch (err) {
      console.error('Error al guardar configuración:', err);
      alert('Error guardando la configuración en la base de datos local SQLite.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
