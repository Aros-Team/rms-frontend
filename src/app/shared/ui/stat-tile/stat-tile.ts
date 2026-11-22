import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { RmsSkeleton } from '../skeleton/skeleton';

export type RmsDeltaTone = 'positive' | 'negative' | 'neutral';

/**
 * `app-rms-stat-tile` — KPI value.
 *
 * The value is a string (format money/percent with the existing pipes) and the
 * period qualifier is mandatory in practice: "Ventas netas — Último mes", not
 * an unlabeled number. Missing values render an em dash, never `0.00%` from an
 * empty denominator (F-014).
 */
@Component({
  selector: 'app-rms-stat-tile',
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.css',
  imports: [RmsSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RmsStatTile {
  @Input({ required: true }) label!: string;
  @Input() value: string | number | null = null;
  @Input() period = '';
  @Input() delta = '';
  @Input() deltaTone: RmsDeltaTone = 'neutral';
  @Input() icon = '';
  @Input() loading = false;
  @Input() emphasis = false;

  get displayValue(): string {
    const value = this.value;
    return value === null || value === '' ? '—' : String(value);
  }

  get deltaIcon(): string {
    switch (this.deltaTone) {
      case 'positive':
        return 'pi pi-arrow-up-right';
      case 'negative':
        return 'pi pi-arrow-down-right';
      default:
        return 'pi pi-minus';
    }
  }
}
