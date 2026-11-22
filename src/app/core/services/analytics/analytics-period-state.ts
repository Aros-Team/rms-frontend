import { Injectable, computed, signal } from '@angular/core';

import {
  defaultPeriod,
  defaultPresetFor,
  presetsFor,
  rangeForLast,
  rangeLabel,
  type BucketPreset,
  type PeriodRange,
} from '@app/core/services/analytics/analytics-utils';
import type { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';

/** Applied analytics period: one bucket plus an inclusive, bucket-shaped range. */
export interface AnalyticsPeriodSelection {
  bucket: TimeBucket;
  from: string;
  to: string;
}

/** Built-in presets plus the `custom` marker used after a manual range. */
export const CUSTOM_PRESET = 'custom';

/**
 * Single source of truth for the analytics period.
 *
 * The shell renders one selector; every section reads this service. Because
 * the label is computed from the same `bucket/from/to` that go on the wire,
 * the dock can never show a different range from the request (Sprint 0
 * F-014: the dock said May–October while the request was June–November).
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsPeriodState {
  private readonly initial = defaultPeriod();

  private readonly bucketSignal = signal<TimeBucket>(this.initial.bucket);
  private readonly rangeSignal = signal<PeriodRange>({ from: this.initial.from, to: this.initial.to });
  private readonly presetSignal = signal<string>(defaultPresetFor('monthly').id);
  private readonly revisionSignal = signal(0);

  readonly bucket = this.bucketSignal.asReadonly();
  readonly from = computed(() => this.rangeSignal().from);
  readonly to = computed(() => this.rangeSignal().to);

  readonly period = computed<AnalyticsPeriodSelection>(() => ({
    bucket: this.bucketSignal(),
    from: this.rangeSignal().from,
    to: this.rangeSignal().to,
  }));

  /** Increments when the shell asks every section to reload after a refresh. */
  readonly revision = this.revisionSignal.asReadonly();

  readonly preset = this.presetSignal.asReadonly();
  readonly presets = computed<BucketPreset[]>(() => presetsFor(this.bucketSignal()));

  /** Label derived from the applied keys, never from a separate offset. */
  readonly label = computed(() =>
    rangeLabel(this.bucketSignal(), this.rangeSignal().from, this.rangeSignal().to),
  );

  /** Chooses the bucket and moves to its default preset in one step. */
  setBucket(bucket: TimeBucket): void {
    if (bucket === this.bucketSignal()) return;
    const preset = defaultPresetFor(bucket);
    this.bucketSignal.set(bucket);
    this.applyPreset(preset.id);
  }

  /** Applies a preset by id; unknown ids are ignored. */
  applyPreset(presetId: string): void {
    const preset = presetsFor(this.bucketSignal()).find((candidate) => candidate.id === presetId);
    if (preset === undefined) return;
    this.rangeSignal.set(rangeForLast(this.bucketSignal(), preset.count));
    this.presetSignal.set(preset.id);
  }

  /** Applies a validated manual range. Callers validate against the bucket. */
  setRange(from: string, to: string): void {
    this.rangeSignal.set({ from, to });
    this.presetSignal.set(CUSTOM_PRESET);
  }

  /** Returns to monthly / last six months. */
  reset(): void {
    this.bucketSignal.set('monthly');
    this.rangeSignal.set(rangeForLast('monthly', 6));
    this.presetSignal.set(defaultPresetFor('monthly').id);
  }

  /** Signal to sections whose data is not held in a cache (alerts). */
  requestRevision(): void {
    this.revisionSignal.update((value) => value + 1);
  }
}
