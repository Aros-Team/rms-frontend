import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface Tab {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly link: string;
  readonly exact: boolean;
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
    { id: 'prime-cost', label: 'Costo primo', icon: 'pi pi-chart-line', link: '/admin/analytics/prime-cost', exact: false },
    { id: 'menu-engineering', label: 'Carta', icon: 'pi pi-th-large', link: '/admin/analytics/menu-engineering', exact: false },
    { id: 'operations', label: 'Operaciones', icon: 'pi pi-stopwatch', link: '/admin/analytics/operations', exact: false },
    { id: 'cohort', label: 'Cohorte', icon: 'pi pi-users', link: '/admin/analytics/cohort', exact: false },
    { id: 'alerts', label: 'Alertas', icon: 'pi pi-bell', link: '/admin/analytics/alerts', exact: false },
  ];
}