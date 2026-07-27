import { Pipe, PipeTransform } from '@angular/core';
import { MetricValue as MetricValueModel } from '@app/shared/models/dto/analytics/metric-value';

@Pipe({ name: 'metricValue', standalone: true })
export class MetricValue implements PipeTransform {
  transform(value: MetricValueModel | null | undefined, fractionDigits = 2, locale = 'es-CO'): string {
    if (!value) return '—';
    const n = Number.parseFloat(value.amount);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  }
}
