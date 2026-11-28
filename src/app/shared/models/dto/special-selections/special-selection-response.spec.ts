/**
 * Tests for the `SpecialSelectionResponse.basePrice` money contract.
 *
 * Feature: `basePrice` is `MoneyDto { amount: string, currency: string }` on the
 * wire. Consumers must normalize it with `toAmount()` before any arithmetic and
 * render it with the `money` pipe.
 * Contract:
 *  - `toAmount(basePrice)` on the wire shape yields the exact number, never `NaN`
 *  - summing two wire-shaped base prices yields the exact total (this is the bug
 *    that shipped green when specs used bare-number fixtures: `"15000.00" +
 *    "12500.00"` concatenates, and `{...} + {...}` is `NaN`)
 *  - the `money` pipe renders the wire shape as the exact COP string
 *  - a numeric `amount` (transitional tolerance in the `Money` type) still works
 *
 * Approach: pure functions only (no TestBed); fixtures are built from the real
 * wire shape and assertions compare exact values, so a regression to naive
 * arithmetic fails immediately.
 */
import { Money } from '@app/shared/models/dto/common/money';
import { tryToAmount, toAmount } from '@app/shared/models/dto/common/money';
import { Money as MoneyPipe } from '@app/shared/pipes/money/money';

import type { SpecialSelectionResponse } from './special-selection-response';

function makeSelection(basePrice: Money): SpecialSelectionResponse {
  return {
    productId: 1,
    name: 'Combo Familiar',
    description: '',
    basePrice,
    active: true,
    preparationAreaId: 1,
    selectionType: 'SPECIAL_SELECTION',
    baseRecipeEnabled: false,
    schedulingRequired: false,
    groups: [],
    additions: [],
    questions: [],
    schedule: [],
  };
}

const WIRE_PRICE: Money = { amount: '15000.00', currency: 'COP' };

/** `Intl` separates the COP symbol from the amount with U+00A0. */
function normalize(text: string): string {
  return text
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('SpecialSelectionResponse.basePrice', () => {
  it('normalizes the wire amount to the exact number', () => {
    const selection = makeSelection(WIRE_PRICE);

    expect(toAmount(selection.basePrice)).toBe(15000);
    expect(Number.isNaN(toAmount(selection.basePrice))).toBe(false);
  });

  it('sums two wire-shaped base prices without concatenating or NaN', () => {
    const first = makeSelection(WIRE_PRICE);
    const second = makeSelection({ amount: '12500.00', currency: 'COP' });

    const total = toAmount(first.basePrice) + toAmount(second.basePrice);

    expect(total).toBe(27500);
  });

  it('renders the wire shape as the exact COP string', () => {
    const selection = makeSelection(WIRE_PRICE);

    expect(normalize(new MoneyPipe().transform(selection.basePrice))).toBe('$ 15.000');
  });

  it('keeps a numeric amount usable and renderable', () => {
    const selection = makeSelection({ amount: 12500, currency: 'COP' });

    expect(toAmount(selection.basePrice)).toBe(12500);
    expect(normalize(new MoneyPipe().transform(selection.basePrice))).toBe('$ 12.500');
  });

  it('distinguishes a missing amount from a real zero', () => {
    const selection = makeSelection({ amount: '', currency: 'COP' });

    expect(tryToAmount(selection.basePrice)).toBeNull();
    expect(new MoneyPipe().transform(selection.basePrice)).toBe('—');
  });
});
