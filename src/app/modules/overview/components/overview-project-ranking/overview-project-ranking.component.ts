import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { tablerTrophy } from '@ng-icons/tabler-icons';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { LanguageService } from '../../../../core/services/language.service';
import { formatWorkMinutes } from '../../../../core/interfaces/config.interface';
import { StatisticService } from '../../services/statistic.service';
import { RankingPeriod } from '../../interfaces/statistic.interface';

/** Top 5 projects by time logged in OpenProject this week, this month or the last 3 months. */
@Component({
  selector: 'app-overview-project-ranking',
  standalone: true,
  imports: [FormsModule, SelectButton, NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ tablerTrophy })],
  templateUrl: './overview-project-ranking.component.html',
})
export class OverviewProjectRankingComponent {
  private readonly statisticService = inject(StatisticService);
  private readonly languageService = inject(LanguageService);

  readonly period = signal<RankingPeriod>('month');

  readonly periodOptions = computed(() => {
    this.languageService.currentLang();
    return [
      { label: this.languageService.t('overview.rankingWeek'), value: 'week' },
      { label: this.languageService.t('overview.rankingMonth'), value: 'month' },
      { label: this.languageService.t('overview.rankingQuarter'), value: 'quarter' },
    ];
  });

  readonly rows = computed(() => {
    const { projects, totalMinutes: total } = this.statisticService.ranking(this.period());
    const max = projects[0]?.minutes ?? 0;
    return projects.map((project, index) => ({
      key: project.projectId ?? `none-${index}`,
      position: index + 1,
      name: project.projectName,
      time: formatWorkMinutes(project.minutes),
      share: total ? Math.round((project.minutes / total) * 100) : 0,
      width: max ? Math.max(2, Math.round((project.minutes / max) * 100)) : 0,
      entryCount: project.entryCount,
    }));
  });
}
