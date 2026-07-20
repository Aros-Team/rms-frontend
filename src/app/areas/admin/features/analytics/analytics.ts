import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AnalyticsNav } from './components/analytics-nav/analytics-nav';
import { PeriodSelector } from './components/period-selector/period-selector';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, AnalyticsNav, PeriodSelector],
})
export class Analytics {
  readonly title = 'Estadísticas';
  readonly description = 'Visualiza las estadísticas de tu restaurante';
}