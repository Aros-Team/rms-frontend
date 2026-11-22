import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { Money } from '@shared/pipes/money/money';
import type { MoneyLike } from '@shared/models/dto/common/money';

export interface TreemapItem {
  label: string;
  total: MoneyLike;
  /** Resolved CSS colour for this category. */
  color: string;
}

interface TreemapTile extends TreemapItem {
  amount: number;
  percent: number;
}

interface TreemapRow {
  weight: number;
  tiles: TreemapTile[];
}

/**
 * Lightweight strip treemap.
 *
 * Chart.js has no treemap, and the rectangular slot fits area comparisons much
 * better than a doughnut. Items are sorted by value, grouped into at most three
 * balanced rows, and each row/tile grows proportionally to its total, so area
 * still encodes the value. Colours are tinted with the theme surface and a
 * coloured rail keeps text contrast independent of the category colour.
 *
 * The chart frame around it owns the accessible summary and the data table;
 * this component is the visual plot.
 */
@Component({
  selector: 'app-rms-treemap',
  templateUrl: './treemap.html',
  styleUrl: './treemap.css',
  imports: [Money],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsTreemap {
  @Input({ required: true })
  set items(value: readonly TreemapItem[]) {
    this.rows = this.layout(value);
  }

  rows: TreemapRow[] = [];

  private layout(items: readonly TreemapItem[]): TreemapRow[] {
    const tiles = [...items]
      .map((item) => ({
        ...item,
        amount: Number(item.total),
        percent: 0,
      }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const total = tiles.reduce((sum, item) => sum + item.amount, 0);
    if (total <= 0) return [];
    for (const tile of tiles) {
      tile.percent = Math.round((tile.amount / total) * 1000) / 10;
    }

    const rowCount = Math.ceil(tiles.length / 3);
    const base = Math.floor(tiles.length / rowCount);
    const extra = tiles.length % rowCount;

    const rows: TreemapRow[] = [];
    let index = 0;
    for (let row = 0; row < rowCount; row++) {
      const size = base + (row < extra ? 1 : 0);
      const rowTiles = tiles.slice(index, index + size);
      index += size;
      rows.push({
        weight: rowTiles.reduce((sum, tile) => sum + tile.amount, 0),
        tiles: rowTiles,
      });
    }
    return rows;
  }

  trackRow(index: number): number {
    return index;
  }

  trackTile(_index: number, tile: TreemapTile): string {
    return tile.label;
  }
}
