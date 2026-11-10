/**
 * Tests for the Money pipe.
 *
 * Feature: Renders every money value in the app as a locale-aware currency
 *          string, tolerating all shapes that reach the wire boundary.
 * Contract:
 *  - money object `{ amount, currency }` → uses its own currency
 *  - bare number (what the backend actually sends) → DEFAULT_CURRENCY
 *  - numeric string → parsed, DEFAULT_CURRENCY
 *  - null / undefined / NaN / blank string → em dash ("—")
 *  - COP → 0 decimals ("$ 1.234")
 *  - non-COP → 2 decimals ("US$ 1.000,00")
 *
 * Approach: Instantiate the pipe directly (pure pipe, no TestBed needed) and
 * assert exact/pattern-matched output strings. Currency symbol spacing varies
 * between ICU builds (regular vs non-breaking space), so symbol-separated
 * assertions use `\s?`.
 */
import { describe, expect, it } from 'vitest';

import type { Money as AnalyticsMoney } from '@app/shared/models/dto/analytics/money';
import type { Money as CommonMoney } from '@app/shared/models/dto/common/money';
import { DEFAULT_CURRENCY, Money } from './money';

describe('Money', () => {
  const pipe = new Money();

  describe('empty input', () => {
    it('returns em dash for null', () => {
      expect(pipe.transform(null)).toBe('—');
    });

    it('returns em dash for undefined', () => {
      expect(pipe.transform(undefined)).toBe('—');
    });

    it('returns em dash for NaN', () => {
      expect(pipe.transform(Number.NaN)).toBe('—');
    });

    it('returns em dash for a non-numeric string', () => {
      expect(pipe.transform('notanumber')).toBe('—');
    });

    it('returns em dash for a blank string', () => {
      expect(pipe.transform('   ')).toBe('—');
    });

    it('returns em dash for an object with an unusable amount', () => {
      expect(pipe.transform({ amount: 'notanumber', currency: 'COP' })).toBe('—');
    });
  });

  describe('money objects', () => {
    it('formats a COP money object without decimals', () => {
      const value: CommonMoney = { amount: 1234.4, currency: 'COP' };

      expect(pipe.transform(value)).toMatch(/^\$\s?1\.234$/);
    });

    it('formats a string-amount money object (analytics DTO)', () => {
      const value: AnalyticsMoney = { amount: '1234.40', currency: 'COP' };

      expect(pipe.transform(value)).toMatch(/^\$\s?1\.234$/);
    });

    it('formats a money object with a non-COP currency using 2 decimals', () => {
      const value: AnalyticsMoney = { amount: '1000.00', currency: 'USD' };

      expect(pipe.transform(value)).toMatch(/^US\$\s?1\.000,00$/);
    });

    it('formats zero', () => {
      expect(pipe.transform({ amount: '0', currency: 'COP' })).toMatch(/^\$\s?0$/);
    });

    it('falls back to the default currency when the object has none', () => {
      expect(pipe.transform({ amount: 2500 })).toMatch(/^\$\s?2\.500$/);
    });
  });

  describe('bare numbers and numeric strings', () => {
    it('formats a bare number with 0 decimals for COP', () => {
      expect(pipe.transform(12500)).toMatch(/^\$\s?12\.500$/);
    });

    it('rounds COP to the whole peso', () => {
      expect(pipe.transform(12500.6)).toMatch(/^\$\s?12\.501$/);
    });

    it('formats a numeric string', () => {
      expect(pipe.transform('987654')).toMatch(/^\$\s?987\.654$/);
    });

    it('formats negative amounts keeping the minus sign', () => {
      expect(pipe.transform(-1500)).toMatch(/^-\$\s?1\.500$/);
    });
  });

  describe('currency constant', () => {
    it('defaults to COP', () => {
      expect(DEFAULT_CURRENCY).toBe('COP');
    });
  });

  describe('locale handling', () => {
    it('honours an explicit locale argument', () => {
      expect(pipe.transform(1234, 'en-US')).toMatch(/^COP\s?1,234$/);
    });

    it('does not throw for an unsupported currency and still renders the amount', () => {
      // A well-formed but unknown code (XYZ) has no symbol: Intl renders the code
      // itself with 2 decimals, and older runtimes throw and hit the pipe's
      // "<currency> <amount>" fallback. Either way the amount must survive.
      expect(pipe.transform({ amount: '7', currency: 'XYZ' })).toMatch(/^XYZ\s?7(?:,00)?$/);
    });
  });
});
