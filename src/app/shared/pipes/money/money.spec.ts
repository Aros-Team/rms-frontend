/**
 * Tests for the Money pipe.
 *
 * Feature: Formats Money DTOs into locale-aware COP/USD strings.
 * Contract:
 *  - null/undefined → em dash ("—")
 *  - COP → "$1.234" (no decimals, thousands separator)
 *  - USD → "$1.000,00" (2 decimals)
 *  - Invalid amount → em dash
 *  - Unknown currency → currency-prefixed raw amount fallback
 *
 * Approach: Instantiate pipe directly (no TestBed needed for pure pipes),
 * call transform() with controlled inputs, assert exact output strings.
 */
import { describe, expect, it } from 'vitest';

import { Money as MoneyModel } from '@app/shared/models/dto/analytics/money';
import { Money } from './money';

describe('Money', () => {
  const pipe = new Money();

  it('returns em dash for null value', () => {
    expect(pipe.transform(null)).toBe('—');
  });

  it('returns em dash for undefined value', () => {
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('formats COP with currency symbol and no decimal places', () => {
    const value: MoneyModel = { amount: '1234.40', currency: 'COP' };
    const result = pipe.transform(value);

    expect(result).toMatch(/^\$\s?1\.234$/);
  });

  it('formats USD with currency symbol and 2 decimal places', () => {
    const value: MoneyModel = { amount: '1000.00', currency: 'USD' };
    const result = pipe.transform(value);

    expect(result).toMatch(/^US\$\s?1\.000,00$/);
  });

  it('returns em dash when amount is not a valid number', () => {
    const value: MoneyModel = { amount: 'notanumber', currency: 'COP' };
    expect(pipe.transform(value)).toBe('—');
  });

  it('formats zero COP as COP currency with no decimals', () => {
    const value: MoneyModel = { amount: '0', currency: 'COP' };
    const result = pipe.transform(value);

    expect(result).toMatch(/^\$\s?0$/);
  });

  it('falls back to currency-prefixed raw amount when locale formatting fails', () => {
    const value: MoneyModel = { amount: '7', currency: 'XYZ' };
    const result = pipe.transform(value);

    expect(result).toMatch(/^XYZ\s?7,00$/);
  });
});