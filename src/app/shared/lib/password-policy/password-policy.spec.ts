/**
 * Tests for the client mirror of the backend password policy.
 *
 * Feature: the API accepts a password only when it is 8-64 printable ASCII
 * characters with at least one lowercase, one uppercase, one digit and one
 * ASCII punctuation character (`^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*\p{Punct})[\p{Graph}]{8,64}$`).
 *
 * Contract:
 *  - punctuation outside the old `[!@#$%^&*...]` list (`_`, `~`, `/`, `;`) counts
 *    as a symbol, because the API accepts it;
 *  - accented characters are rejected, because the API's `[\p{Graph}]` is ASCII;
 *  - length is enforced on both ends (8 and 64).
 */
import { describe, expect, it } from 'vitest';

import { hasSymbol, isPasswordValid, isPrintableAscii } from './password-policy';

describe('password policy', () => {
  it('accepts every ASCII punctuation character as a symbol', () => {
    for (const symbol of ['_', '~', '/', ';', '!', '@', '#', '?', '|', '`']) {
      expect(hasSymbol(`Abcdef1${symbol}`)).toBe(true);
    }
  });

  it('does not treat letters or digits as symbols', () => {
    expect(hasSymbol('Abcdef12')).toBe(false);
  });

  it('accepts a password that meets every rule', () => {
    expect(isPasswordValid('Abcdef1_')).toBe(true);
    expect(isPasswordValid('NewPass@123')).toBe(true);
  });

  it('rejects a password missing a character class', () => {
    expect(isPasswordValid('abcdef1_')).toBe(false);
    expect(isPasswordValid('ABCDEF1_')).toBe(false);
    expect(isPasswordValid('Abcdefg_')).toBe(false);
    expect(isPasswordValid('Abcdef12')).toBe(false);
  });

  it('rejects lengths outside 8-64', () => {
    expect(isPasswordValid('Abcde1_')).toBe(false);
    expect(isPasswordValid(`A1_${'a'.repeat(61)}`)).toBe(true);
    expect(isPasswordValid(`A1_${'a'.repeat(62)}`)).toBe(false);
  });

  it('rejects non-ASCII characters, mirroring the API pattern', () => {
    expect(isPrintableAscii('Contraseña1!')).toBe(false);
    expect(isPasswordValid('Contraseña1!')).toBe(false);
  });
});
