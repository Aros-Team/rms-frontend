import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import {
  bucketFormat,
  bucketLabel,
  isValidBucketKey,
  isValidRange,
  presetsFor,
} from '@app/core/services/analytics/analytics-utils';
import type { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';
import { TIME_BUCKETS } from '@app/shared/models/dto/analytics/time-bucket';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsSelect, type RmsSelectOption } from '@app/shared/ui/select/select';

export type PeriodSelectorVariant = 'inline' | 'docked';

/**
 * The workspace's only period control: bucket, preset or manual range.
 *
 * Every value committed here goes through `AnalyticsPeriodState`, so the
 * collapsed label and the request always describe the same keys (F-014).
 */
@Component({
  selector: 'app-period-selector',
  imports: [FormsModule, RmsButton, RmsIconButton, RmsSelect],
  templateUrl: './period-selector.html',
  styleUrl: './period-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodSelector {
  private readonly state = inject(AnalyticsPeriodState);

  readonly refresh = output();

  private readonly variantSignal = signal<PeriodSelectorVariant>('inline');
  readonly variant = this.variantSignal.asReadonly();

  readonly bucket = signal<TimeBucket>(this.state.bucket());
  readonly from = signal<string>(this.state.from());
  readonly to = signal<string>(this.state.to());
  readonly preset = signal<string>(this.state.preset());
  readonly expanded = signal(false);

  readonly bucketOptions: RmsSelectOption[] = TIME_BUCKETS.map((bucket) => ({
    label: bucketLabel(bucket),
    value: bucket,
  }));

  readonly presetOptions = computed<RmsSelectOption[]>(() => {
    const options: RmsSelectOption[] = presetsFor(this.bucket()).map((preset) => ({
      label: preset.label,
      value: preset.id,
    }));
    if (this.preset() === 'custom') {
      options.unshift({ label: 'Personalizado', value: 'custom' });
    }
    return options;
  });

  readonly currentRangeLabel = this.state.label;
  readonly bucketName = computed(() => bucketLabel(this.bucket()));

  readonly formatHint = computed(() => `Formato ${bucketFormat(this.bucket())}`);
  readonly fromValid = computed(() => isValidBucketKey(this.bucket(), this.from()));
  readonly toValid = computed(() => isValidBucketKey(this.bucket(), this.to()));
  readonly rangeValid = computed(() => isValidRange(this.bucket(), this.from(), this.to()));
  readonly errorMessage = computed(() => {
    if (!this.fromValid() || !this.toValid()) {
      return `Formato de fecha inválido. Use ${bucketFormat(this.bucket())}`;
    }
    if (!this.rangeValid()) {
      return 'La fecha final debe ser igual o posterior a la inicial';
    }
    return null;
  });

  setVariant(value: PeriodSelectorVariant): void {
    this.variantSignal.set(value);
  }

  onBucketChange(value: string | number | null): void {
    if (typeof value !== 'string') return;
    this.state.setBucket(value as TimeBucket);
    this.syncFromState();
  }

  onPresetChange(value: string | number | null): void {
    if (typeof value !== 'string' || value === 'custom') return;
    this.state.applyPreset(value);
    this.syncFromState();
  }

  onFromChange(value: string): void {
    this.from.set(value);
  }

  onToChange(value: string): void {
    this.to.set(value);
  }

  toggle(): void {
    this.expanded.update((value) => !value);
  }

  collapse(): void {
    this.expanded.set(false);
  }

  apply(): void {
    if (!this.rangeValid()) return;
    this.state.setRange(this.from(), this.to());
    this.preset.set(this.state.preset());
    if (this.variant() === 'docked') this.collapse();
  }

  reset(): void {
    this.state.reset();
    this.syncFromState();
    if (this.variant() === 'docked') this.collapse();
  }

  refreshActive(): void {
    this.refresh.emit();
  }

  private syncFromState(): void {
    this.bucket.set(this.state.bucket());
    this.from.set(this.state.from());
    this.to.set(this.state.to());
    this.preset.set(this.state.preset());
  }
}
