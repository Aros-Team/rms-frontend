import { Pipe, PipeTransform } from '@angular/core';
import { Money } from '@app/shared/models/dto/analytics/money';

@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(value: Money | null | undefined, locale = 'es-CO'): string {
    if (!value) return '—';
    const amount = Number.parseFloat(value.amount);
    if (Number.isNaN(amount)) return '—';
    const decimals = value.currency === 'COP' ? 0 : 2;
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: value.currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount);
    } catch {
      return `${value.currency} ${value.amount}`;
    }
  }
}
