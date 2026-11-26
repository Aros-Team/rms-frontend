import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/**
 * Workforce module shell (`/admin/team`).
 *
 * Feature: one first-class destination for the people side of the restaurant
 * — employees, schedules, attendance and payroll — instead of hiding those
 * screens inside "Restaurante" or exposing only schedules at the top level.
 *
 * Contract:
 *  - the horizontal sub-navigation is flat: every domain is a sibling route,
 *    so Asistencia and Nómina are never tabs nested inside another module;
 *  - each child route owns its own H1 and its loading/empty/error states;
 *  - the shell only provides the section navigation and the router outlet.
 */
@Component({
  selector: 'app-team',
  imports: [RouterModule],
  templateUrl: './team.html',
  styleUrl: './team.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Team {
  /** Accessible name for the section navigation. */
  readonly navLabel = 'Secciones de equipo';
}
