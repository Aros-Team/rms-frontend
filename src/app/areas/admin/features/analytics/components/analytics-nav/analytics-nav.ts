import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface Tab {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly link: string;
}

@Component({
  selector: 'app-analytics-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './analytics-nav.html',
  styleUrl: './analytics-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsNav {
  readonly tabs: readonly Tab[] = [
    {
      id: 'prime-cost',
      label: 'Rentabilidad',
      icon: 'pi pi-chart-line',
      link: '/admin/analytics/prime-cost',
    },
    {
      id: 'menu-engineering',
      label: 'Tu carta',
      icon: 'pi pi-th-large',
      link: '/admin/analytics/menu-engineering',
    },
    {
      id: 'operations',
      label: 'Operación',
      icon: 'pi pi-clock',
      link: '/admin/analytics/operations',
    },
    {
      id: 'cohort',
      label: 'Cohortes',
      icon: 'pi pi-users',
      link: '/admin/analytics/cohort',
    },
    {
      id: 'alerts',
      label: 'Alertas',
      icon: 'pi pi-bell',
      link: '/admin/analytics/alerts',
    },
  ];
}
