import { describe, expect, it } from 'vitest';

import { Money } from '@app/shared/models/dto/analytics/money';
import { MoneyPipe } from './money';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('returns em dash for null value', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined value', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('formats COP with currency symbol and no decimal places', () => {
    const value: Money = { amount: '1234.40', currency: 'COP' };
    const result = pipe.transform(value);

    expect(result).toContain('$');
    expect(result).not.toContain(',40');
    expect(result).not.toContain('.40');
    expect(result).toContain('1.234');
  });

  it('formats USD with currency symbol and 2 decimal places', () => {
    const value: Money = { amount: '1000.00', currency: 'USD' };
    const result = pipe.transform(value);

    expect(result).toContain('1.000');
    expect(result).toContain(',00');
  });

  it('returns em dash when amount is not a valid number', () => {
    const value: Money = { amount: 'notanumber', currency: 'COP' };
    expect(pipe.transform(value)).toBe('—');
  });

  it('formats zero COP as COP currency with no decimals', () => {
    const value: Money = { amount: '0', currency: 'COP' };
    const result = pipe.transform(value);

    expect(result).toContain('$');
    expect(result).not.toContain('.00');
  });

  it('falls back to currency-prefixed raw amount when locale formatting fails', () => {
    const value: Money = { amount: '7', currency: 'XYZ' };
    const result = pipe.transform(value);

    expect(result).toContain('XYZ');
    expect(result).toContain('7');
  });
});