import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UIChart } from 'primeng/chart';
import { SelectButton } from 'primeng/selectbutton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerChartBar } from '@ng-icons/tabler-icons';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { formatWorkMinutes } from '../../../../core/interfaces/config.interface';
import { StatisticService } from '../../services/statistic.service';
import { ChartRange } from '../../interfaces/statistic.interface';

/** Daily logged hours (bars) against the schedule target (dashed line) for the last 7 or 30 days. */
@Component({
  selector: 'app-overview-time-chart',
  standalone: true,
  imports: [FormsModule, UIChart, SelectButton, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerChartBar })],
  templateUrl: './overview-time-chart.component.html',
})
export class OverviewTimeChartComponent {
  private readonly statisticService = inject(StatisticService);
  private readonly languageService = inject(LanguageService);
  private readonly themeService = inject(ThemeService);

  readonly range = signal<ChartRange>(7);

  readonly rangeOptions = computed(() => {
    this.languageService.currentLang();
    return [
      { label: this.languageService.t('overview.last7Days'), value: 7 },
      { label: this.languageService.t('overview.last30Days'), value: 30 },
    ];
  });

  private readonly points = computed(() => this.statisticService.last30Days().slice(-this.range()));

  readonly data = computed<ChartData<'bar' | 'line', number[], string>>(() => {
    const points = this.points();
    const primary = this.themeService.currentHex();
    const dark = this.themeService.isDark();
    const locale = this.languageService.currentLang();
    const formatter = new Intl.DateTimeFormat(locale, this.range() === 7 ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' });

    return {
      labels: points.map((p) => formatter.format(new Date(`${p.date}T00:00:00`))),
      datasets: [
        {
          type: 'bar',
          label: this.languageService.t('overview.logged'),
          data: points.map((p) => p.minutes),
          backgroundColor: primary,
          hoverBackgroundColor: primary,
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 28,
          order: 2,
        },
        {
          type: 'line',
          label: this.languageService.t('overview.target'),
          data: points.map((p) => p.targetMinutes),
          borderColor: dark ? '#a1a1aa' : '#94a3b8',
          backgroundColor: dark ? '#a1a1aa' : '#94a3b8',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          pointHoverRadius: 4,
          stepped: 'middle',
          order: 1,
        },
      ],
    };
  });

  readonly options = computed<ChartOptions<'bar'>>(() => {
    const dark = this.themeService.isDark();
    const text = dark ? '#a1a1aa' : '#64748b';
    const grid = dark ? 'rgba(63, 63, 70, 0.6)' : 'rgba(226, 232, 240, 0.8)';
    return {
      maintainAspectRatio: false,
      animation: { duration: 250 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: text, usePointStyle: true, boxWidth: 8, boxHeight: 8, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (item: TooltipItem<'bar'>) => `${item.dataset.label}: ${formatWorkMinutes(Number(item.raw) || 0)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: text, font: { size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: grid },
          ticks: {
            color: text,
            font: { size: 11 },
            stepSize: 120,
            callback: (value) => `${Math.round(Number(value) / 60)}h`,
          },
        },
      },
    };
  });
}
