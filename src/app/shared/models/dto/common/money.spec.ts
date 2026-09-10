/**
 * Tests for the Money DTO type contract.
 *
 * Feature: TypeScript interface for monetary values (amount + currency).
 * Contract: Money objects accept numeric amounts and currency strings.
 * Approach: Create Money objects with various values, assert they compile and hold correct data.
 */
import { Money } from './money';

describe('Money', () => {
  it('accepts amount and currency', () => {
    const m: Money = { amount: 100.5, currency: 'COP' };
    expect(m.amount).toBe(100.5);
    expect(m.currency).toBe('COP');
  });

  it('accepts zero amount', () => {
    const m: Money = { amount: 0, currency: 'USD' };
    expect(m.amount).toBe(0);
  });
});
