import { Pipe, PipeTransform } from '@angular/core';
import { MetricValue } from '@app/shared/models/dto/analytics/metric-value';

@Pipe({ name: 'metricValue', standalone: true })
export class MetricValuePipe implements PipeTransform {
  transform(value: MetricValue | null | undefined, fractionDigits = 2, locale = 'es-CO'): string {
    if (!value) return '—';
    const n = Number.parseFloat(value.amount);
    if (Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(n);
  }
}
