import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import {
  isValidPeriodKey,
  isValidRange,
  titleForKey,
} from '@app/core/services/analytics/analytics-utils';

export type PeriodSelectorVariant = 'inline' | 'docked';

@Component({
  selector: 'app-period-selector',
  imports: [FormsModule, InputTextModule, ButtonModule, MessageModule],
  templateUrl: './period-selector.html',
  styleUrl: './period-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodSelector {
  private readonly state = inject(AnalyticsPeriodState);

  readonly refresh = output();

  private readonly variantSignal = signal<PeriodSelectorVariant>('inline');

  setVariant(value: PeriodSelectorVariant): void {
    this.variantSignal.set(value);
  }
  readonly variant = this.variantSignal.asReadonly();

  from = signal<string>(this.state.from());
  to = signal<string>(this.state.to());

  readonly fromValid = computed(() => isValidPeriodKey(this.from()));
  readonly toValid = computed(() => isValidPeriodKey(this.to()));
  readonly rangeValid = computed(() => isValidRange(this.from(), this.to()));
  readonly errorMessage = computed(() => {
    if (!this.fromValid() || !this.toValid()) return 'Formato de fecha inválido. Use AAAA-MM';
    if (!this.rangeValid()) return 'La fecha final debe ser igual o posterior a la inicial';
    return null;
  });

  readonly placeholderExample = 'AAAA-MM';

  fromTitle = computed(() => titleForKey(this.from()));
  toTitle = computed(() => titleForKey(this.to()));

  readonly expanded = signal(false);
  readonly currentRangeLabel = computed(() => {
    const fromLabel = this.fromTitle();
    const toLabel = this.toTitle();
    return `${fromLabel} – ${toLabel}`;
  });

  constructor() {
    queueMicrotask(() => {
      this.from.set(this.state.from());
      this.to.set(this.state.to());
    });
  }

  onFromChange(value: string): void {
    this.from.set(value);
  }

  onToChange(value: string): void {
    this.to.set(value);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  collapse(): void {
    this.expanded.set(false);
  }

  apply(): void {
    if (!this.rangeValid() || !this.fromValid() || !this.toValid()) return;
    this.commit();
    if (this.variant() === 'docked') this.collapse();
  }

  reset(): void {
    this.state.reset();
    this.from.set(this.state.from());
    this.to.set(this.state.to());
    if (this.variant() === 'docked') this.collapse();
  }

  refreshActive(): void {
    this.refresh.emit();
  }

  private commit(): void {
    this.state.setRange(this.from(), this.to());
  }
}
