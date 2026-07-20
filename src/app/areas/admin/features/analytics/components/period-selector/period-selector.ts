import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { AnalyticsPeriodState } from '@app/core/services/analytics/analytics-period-state';
import { TimeBucket } from '@app/shared/models/dto/analytics/time-bucket';
import {
  isValidPeriodKey,
  isValidRange,
  titleForKey,
} from '@app/core/services/analytics/analytics-utils';

interface BucketOption {
  readonly label: string;
  readonly value: TimeBucket;
}

@Component({
  selector: 'app-period-selector',
  imports: [FormsModule, SelectModule, InputTextModule, ButtonModule, MessageModule],
  templateUrl: './period-selector.html',
  styleUrl: './period-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodSelector {
  private readonly state = inject(AnalyticsPeriodState);

  readonly bucketOptions: BucketOption[] = [
    { label: 'Diario', value: 'daily' },
    { label: 'Semanal', value: 'weekly' },
    { label: 'Mensual', value: 'monthly' },
    { label: 'Anual', value: 'yearly' },
  ];

  bucket = this.state.bucket;
  from = signal<string>(this.state.from());
  to = signal<string>(this.state.to());

  readonly fromValid = computed(() => isValidPeriodKey(this.from(), this.bucket()));
  readonly toValid = computed(() => isValidPeriodKey(this.to(), this.bucket()));
  readonly rangeValid = computed(() => isValidRange(this.from(), this.to(), this.bucket()));
  readonly errorMessage = computed(() => {
    if (!this.fromValid() || !this.toValid()) return 'Formato de fecha inválido para el bucket seleccionado';
    if (!this.rangeValid()) return 'La fecha final debe ser igual o posterior a la inicial';
    return null;
  });

  readonly placeholderExample = computed(() => {
    const bucket = this.bucket();
    switch (bucket) {
      case 'daily':   return 'AAAA-MM-DD';
      case 'weekly':  return 'AAAA-Www';
      case 'monthly': return 'AAAA-MM';
      case 'yearly':  return 'AAAA';
    }
  });

  fromTitle = computed(() => titleForKey(this.from(), this.bucket()));
  toTitle = computed(() => titleForKey(this.to(), this.bucket()));

  constructor() {
    queueMicrotask(() => {
      this.from.set(this.state.from());
      this.to.set(this.state.to());
    });
  }

  onBucketChange(bucket: TimeBucket): void {
    this.state.setBucket(bucket);
    this.from.set(this.state.from());
    this.to.set(this.state.to());
    this.commit();
  }

  onFromChange(value: string): void {
    this.from.set(value);
  }

  onToChange(value: string): void {
    this.to.set(value);
  }

  apply(): void {
    if (!this.rangeValid() || !this.fromValid() || !this.toValid()) return;
    this.commit();
  }

  reset(): void {
    this.state.reset();
    this.from.set(this.state.from());
    this.to.set(this.state.to());
  }

  private commit(): void {
    this.state.setRange(this.from(), this.to());
  }
}