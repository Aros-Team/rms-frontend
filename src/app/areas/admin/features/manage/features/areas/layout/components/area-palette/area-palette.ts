import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

import type { AreaActivityValue, AreaResponse } from '@app/shared/models/dto/areas/area';

import { areaColorIndex } from '../../lib/area-colors';

const ACTIVITY_LABELS: Record<AreaActivityValue, string> = {
  PREPARATION: 'Preparación',
  SERVE: 'Servicio',
  CASH: 'Caja',
};

/** Area picker for the layout editor. */
@Component({
  selector: 'app-area-palette',
  templateUrl: './area-palette.html',
  styleUrl: './area-palette.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AreaPalette {
  private readonly areasState = signal<readonly AreaResponse[]>([]);
  private readonly selectedAreaState = signal<number | null>(null);
  private readonly regionCountsState = signal<ReadonlyMap<number, number>>(new Map());
  private readonly disabledState = signal(false);

  @Input({ required: true })
  set areas(value: readonly AreaResponse[]) {
    this.areasState.set(value);
  }

  get areas(): readonly AreaResponse[] {
    return this.areasState();
  }

  @Input()
  set selectedAreaId(value: number | null) {
    this.selectedAreaState.set(value);
  }

  get selectedAreaId(): number | null {
    return this.selectedAreaState();
  }

  @Input()
  set regionCounts(value: ReadonlyMap<number, number>) {
    this.regionCountsState.set(value);
  }

  get regionCounts(): ReadonlyMap<number, number> {
    return this.regionCountsState();
  }

  @Input()
  set disabled(value: boolean) {
    this.disabledState.set(value);
  }

  get disabled(): boolean {
    return this.disabledState();
  }

  @Output() readonly areaSelect = new EventEmitter<number>();

  readonly items = computed(() =>
    this.areasState().map((area) => ({
      area,
      colorIndex: areaColorIndex(area.id),
      activities: this.activityLabels(area.activities),
      regionCount: this.regionCountsState().get(area.id) ?? 0,
    })),
  );

  isSelected(id: number): boolean {
    return this.selectedAreaState() === id;
  }

  select(id: number): void {
    if (this.disabled) return;
    this.areaSelect.emit(id);
  }

  private activityLabels(activities: readonly AreaActivityValue[] | undefined): string {
    if (activities === undefined || activities.length === 0) return 'Sin actividad';
    return activities.map((activity) => ACTIVITY_LABELS[activity]).join(' · ');
  }
}
