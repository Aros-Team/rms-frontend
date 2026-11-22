import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';

import { Schedules } from './schedules';
import { TimeLogsPanel } from './time-logs-panel/time-logs-panel';
import { WeekGrid } from './week-grid/week-grid';

type SchedulesTab = 'semana' | 'plantillas' | 'registros';

interface TabDefinition {
  readonly id: SchedulesTab;
  readonly label: string;
  readonly icon: string;
}

const TABS: readonly TabDefinition[] = [
  { id: 'semana', label: 'Semana', icon: 'pi pi-calendar' },
  { id: 'plantillas', label: 'Plantillas', icon: 'pi pi-clone' },
  { id: 'registros', label: 'Asistencia', icon: 'pi pi-clock' },
];

/**
 * Schedules module page.
 *
 * Feature: the first-class admin route for the weekly grid, the template
 * manager and the attendance read. The tab is deep-linkable (`?tab=`), so a
 * navigation entry can land on the grid while the template editor stays a
 * stable secondary destination.
 *
 * Contract:
 *  - one H1 for the route, owned by the page header;
 *  - tabs unmount the inactive panel, so switching to "Asistencia" never keeps
 *    polling the schedule or vice versa;
 *  - the grid and the template manager each own their loading, empty, error
 *    and permission states; this page does not duplicate them.
 */
@Component({
  selector: 'app-schedules-page',
  imports: [RmsPageHeader, Schedules, TimeLogsPanel, WeekGrid],
  templateUrl: './schedules-page.html',
  styleUrl: './schedules-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulesPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tabs = TABS;
  readonly activeTab = signal<SchedulesTab>(this.initialTab());
  /** Bumped when a template changes so the grid refetches on its next visit. */
  readonly templatesVersion = signal(0);

  selectTab(id: SchedulesTab): void {
    this.activeTab.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) {
      return;
    }
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowLeft') {
      next = (index - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'ArrowRight') {
      next = (index + 1) % this.tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = this.tabs.length - 1;
    }
    this.selectTab(this.tabs[next].id);
  }

  onTemplateChanged(): void {
    this.templatesVersion.update((version) => version + 1);
  }

  private initialTab(): SchedulesTab {
    const requested = this.route.snapshot.queryParamMap.get('tab');
    return TABS.some((tab) => tab.id === requested)
      ? (requested as SchedulesTab)
      : 'semana';
  }
}
