import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  signal,
} from '@angular/core';

import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import type { FloorLayout as FloorLayoutDto } from '@app/shared/models/dto/floor-layout/floor-layout';

import { layoutFromDto, mergeCellsByArea, shapeForCells } from '../../lib/geometry';

/** Read-only miniature of the saved floor distribution. */
@Component({
  selector: 'app-layout-preview',
  templateUrl: './layout-preview.html',
  styleUrl: './layout-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutPreview {
  private static nextId = 0;

  private readonly layoutState = signal<FloorLayoutDto | null>(null);
  private readonly areasState = signal<readonly AreaResponse[]>([]);

  @Input({ required: true })
  set layout(value: FloorLayoutDto | null) {
    this.layoutState.set(value);
  }

  get layout(): FloorLayoutDto | null {
    return this.layoutState();
  }

  @Input()
  set areas(value: readonly AreaResponse[]) {
    this.areasState.set(value);
  }

  get areas(): readonly AreaResponse[] {
    return this.areasState();
  }

  readonly gridId = `floor-preview-grid-${String(LayoutPreview.nextId++)}`;
  readonly Math = Math;

  readonly hasRegions = computed(() => (this.layoutState()?.regions.length ?? 0) > 0);

  readonly items = computed(() => {
    const dto = this.layoutState();
    if (dto === null) return [];
    const names = new Map(this.areasState().map((area) => [area.id, area.name]));
    return [...mergeCellsByArea(layoutFromDto(dto)).entries()]
      .map(([areaId, cells]) => ({
        areaId,
        shape: shapeForCells(cells),
        name: names.get(areaId) ?? `Área ${String(areaId)}`,
      }))
      .sort((left, right) => left.areaId - right.areaId);
  });

  /** Crops the viewBox around the painted content with a little breathing room. */
  readonly frame = computed(() => {
    const dto = this.layoutState();
    const items = this.items();
    if (dto === null) {
      return { viewBox: '0 0 1 1', x: 0, y: 0, width: 1, height: 1 };
    }
    if (items.length === 0) {
      return {
        viewBox: `0 0 ${String(dto.columns)} ${String(dto.rows)}`,
        x: 0,
        y: 0,
        width: dto.columns,
        height: dto.rows,
      };
    }

    let minRow = Number.POSITIVE_INFINITY;
    let maxRow = Number.NEGATIVE_INFINITY;
    let minColumn = Number.POSITIVE_INFINITY;
    let maxColumn = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      minRow = Math.min(minRow, item.shape.bounds.minRow);
      maxRow = Math.max(maxRow, item.shape.bounds.maxRow);
      minColumn = Math.min(minColumn, item.shape.bounds.minColumn);
      maxColumn = Math.max(maxColumn, item.shape.bounds.maxColumn);
    }

    const padding = 2;
    const x = minColumn - padding;
    const y = minRow - padding;
    const width = maxColumn - minColumn + 1 + padding * 2;
    const height = maxRow - minRow + 1 + padding * 2;
    return {
      viewBox: `${String(x)} ${String(y)} ${String(width)} ${String(height)}`,
      x,
      y,
      width,
      height,
    };
  });

  regionLabel(name: string): string {
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
  }
}
