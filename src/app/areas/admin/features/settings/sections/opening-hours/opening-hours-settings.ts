import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnInit,
  Output,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SettingsApi } from '@services/settings/settings-api';
import { problemMessage } from '@services/settings/problem-detail';
import type { OpeningHoursDay, WeekdayName } from '@models/dto/settings/settings';
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from '@models/dto/settings/settings';
import { RmsButton } from '@shared/ui/button/button';
import { RmsEmptyState } from '@shared/ui/empty-state/empty-state';
import { RmsSection } from '@shared/ui/section/section';
import { RmsSkeleton } from '@shared/ui/skeleton/skeleton';

/**
 * Opening-hours section.
 *
 * Contract: `GET/PUT /v1/settings/opening-hours`, one window per weekday.
 * The dashboard clips the hourly chart to today's window and the schedule
 * coverage flags hours inside it without staff. Holidays use the Sunday window
 * until a holiday calendar exists.
 */
@Component({
  selector: 'app-settings-opening-hours',
  templateUrl: './opening-hours-settings.html',
  styleUrl: './opening-hours-settings.css',
  imports: [FormsModule, RmsSection, RmsButton, RmsEmptyState, RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpeningHoursSettingsSection implements OnInit {
  private readonly api = inject(SettingsApi);

  @Output() readonly dirtyChange = new EventEmitter<boolean>();

  readonly days = signal<OpeningHoursDay[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly weekdays = WEEKDAY_ORDER;
  readonly labels = WEEKDAY_LABELS;

  private savedSnapshot = '';

  readonly dirty = computed(() => this.snapshot(this.days()) !== this.savedSnapshot);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getOpeningHours().subscribe({
      next: (response) => {
        const ordered = this.ordered(response.days);
        this.days.set(ordered);
        this.savedSnapshot = this.snapshot(ordered);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(problemMessage(error, 'No se pudo cargar el horario de atención.'));
        this.loading.set(false);
      },
    });
  }

  day(name: WeekdayName): OpeningHoursDay {
    return (
      this.days().find((candidate) => candidate.dayOfWeek === name) ?? {
        dayOfWeek: name,
        closed: true,
        openTime: null,
        closeTime: null,
      }
    );
  }

  setClosed(name: WeekdayName, closed: boolean): void {
    this.days.update((days) =>
      days.map((day) =>
        day.dayOfWeek === name
          ? {
              ...day,
              closed,
              openTime: closed ? null : (day.openTime ?? '08:00'),
              closeTime: closed ? null : (day.closeTime ?? '22:00'),
            }
          : day,
      ),
    );
    this.emitDirty();
  }

  setTime(name: WeekdayName, field: 'openTime' | 'closeTime', value: string): void {
    this.days.update((days) =>
      days.map((day) => (day.dayOfWeek === name ? { ...day, [field]: value } : day)),
    );
    this.emitDirty();
  }

  save(): void {
    this.saveError.set(null);
    this.notice.set(null);
    const invalid = this.days().find(
      (day) => !day.closed && (!day.openTime || !day.closeTime || day.closeTime <= day.openTime),
    );
    if (invalid !== undefined) {
      this.saveError.set(
        `Revisa ${WEEKDAY_LABELS[invalid.dayOfWeek]}: la hora de cierre debe ser posterior a la de apertura.`,
      );
      return;
    }

    this.saving.set(true);
    this.api.updateOpeningHours({ days: this.ordered(this.days()) }).subscribe({
      next: (response) => {
        const ordered = this.ordered(response.days);
        this.days.set(ordered);
        this.savedSnapshot = this.snapshot(ordered);
        this.saving.set(false);
        this.notice.set('Horario de atención guardado.');
        this.dirtyChange.emit(false);
      },
      error: (error: unknown) => {
        this.saveError.set(problemMessage(error, 'No se pudo guardar el horario de atención.'));
        this.saving.set(false);
      },
    });
  }

  private ordered(days: readonly OpeningHoursDay[]): OpeningHoursDay[] {
    return WEEKDAY_ORDER.flatMap((name) => {
      const day = days.find((candidate) => candidate.dayOfWeek === name);
      return day === undefined ? [] : [day];
    });
  }

  private snapshot(days: readonly OpeningHoursDay[]): string {
    return JSON.stringify(this.ordered(days));
  }

  private emitDirty(): void {
    this.dirtyChange.emit(this.snapshot(this.days()) !== this.savedSnapshot);
  }
}
