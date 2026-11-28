import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { RmsButton } from '@app/shared/ui/button/button';
import { ShiftPlanner } from './shift-planner/shift-planner';
import { WeekGrid } from './week-grid/week-grid';

type SchedulesView = 'semana' | 'turnos';

/**
 * Schedules module page.
 *
 * Feature: the first-class admin route for the weekly grid and the individual
 * shift planner. The week is the landing view; a button opens the shift
 * planner and a back button returns to the week. Attendance lives in its own
 * `/admin/team/attendance` route.
 *
 * Contract:
 *  - one H1 for the route, owned by the page header;
 *  - navigation is button-driven, not a tablist; the view stays deep-linkable
 *    through `?tab=turnos` so the assistant can open the planner directly;
 *  - only the active view is mounted, so switching never keeps the other one
 *    polling;
 *  - the grid and the planner each own their loading, empty, error and
 *    permission states; this page does not duplicate them.
 */
@Component({
  selector: 'app-schedules-page',
  imports: [RmsButton, ShiftPlanner, WeekGrid],
  templateUrl: './schedules-page.html',
  styleUrl: './schedules-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulesPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  readonly activeTab = signal<SchedulesView>(this.initialView());
  /** Bumped when a shift changes so the grid refetches on its next visit. */
  readonly shiftsVersion = signal(0);

  constructor() {
    // The assistant can navigate while this page is already mounted, so the
    // view must follow query-param changes instead of reading the snapshot once.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const view = this.viewFrom(params.get('tab'));
      if (view !== this.activeTab()) {
        this.activeTab.set(view);
      }
    });
  }

  selectTab(id: SchedulesView): void {
    this.activeTab.set(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onShiftChanged(): void {
    this.shiftsVersion.update((version) => version + 1);
  }

  private initialView(): SchedulesView {
    return this.viewFrom(this.route.snapshot.queryParamMap.get('tab'));
  }

  private viewFrom(requested: string | null): SchedulesView {
    // The old "plantillas" deep link now opens the individual shift planner.
    if (requested === 'plantillas' || requested === 'turnos') return 'turnos';
    return 'semana';
  }
}
