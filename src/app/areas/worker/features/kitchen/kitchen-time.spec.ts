/**
 * Tests for the kitchen timer model.
 *
 * Feature: every ticket shows how long it has been on the pass, and the board
 * highlights orders that need attention.
 * Contract:
 *  - the age is measured from the order date, clamped at zero;
 *  - 8 min enters "Atención", 15 min enters "Atrasado";
 *  - the label is `MM:SS` under an hour and `H:MM:SS` above it;
 *  - a malformed date never renders `NaN`.
 */
import {
  KITCHEN_LATE_MS,
  KITCHEN_WARNING_MS,
  formatAge,
  formatClock,
  formatOrderTime,
  orderAgeMs,
  urgencyFor,
  urgencyLabel,
  urgencyTone,
} from './kitchen-time';

const DATE = '2026-01-01T12:00:00';

describe('kitchen time', () => {
  it('measures the age from the order date and clamps clock skew at zero', () => {
    const now = Date.parse('2026-01-01T12:05:30');
    expect(orderAgeMs(DATE, now)).toBe(5 * 60 * 1000 + 30 * 1000);
    expect(orderAgeMs(DATE, Date.parse('2026-01-01T11:00:00'))).toBe(0);
    expect(orderAgeMs('not-a-date', now)).toBe(0);
  });

  it('enters warning at 8 minutes and late at 15 minutes', () => {
    expect(urgencyFor(0)).toBe('fresh');
    expect(urgencyFor(KITCHEN_WARNING_MS - 1)).toBe('fresh');
    expect(urgencyFor(KITCHEN_WARNING_MS)).toBe('warning');
    expect(urgencyFor(KITCHEN_LATE_MS - 1)).toBe('warning');
    expect(urgencyFor(KITCHEN_LATE_MS)).toBe('late');
  });

  it('labels and tones each urgency consistently', () => {
    expect(urgencyLabel('fresh')).toBe('En tiempo');
    expect(urgencyLabel('warning')).toBe('Atención');
    expect(urgencyLabel('late')).toBe('Atrasado');
    expect(urgencyTone('fresh')).toBe('success');
    expect(urgencyTone('warning')).toBe('warning');
    expect(urgencyTone('late')).toBe('danger');
  });

  it('formats MM:SS and rolls into H:MM:SS after an hour', () => {
    expect(formatAge(0)).toBe('00:00');
    expect(formatAge(65_000)).toBe('01:05');
    expect(formatAge(59 * 60 * 1000 + 59_000)).toBe('59:59');
    expect(formatAge(60 * 60 * 1000 + 65_000)).toBe('1:01:05');
    expect(formatAge(-5)).toBe('00:00');
  });

  it('formats order and sync clocks as HH:mm and degrades to an empty string', () => {
    expect(formatOrderTime(DATE)).toBe('12:00');
    expect(formatOrderTime('')).toBe('');
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(formatClock(new Date(Number.NaN))).toBe('');
    expect(formatClock(null)).toBe('');
  });
});
