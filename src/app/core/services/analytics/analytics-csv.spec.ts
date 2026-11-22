/**
 * Tests for CSV export.
 *
 * Feature: one CSV builder per analytics section.
 * Contract: raw decimal amounts, CRLF rows, quoted cells when needed.
 * Approach: builders over the shared fixtures; assert exact headers and values.
 */
import { describe, expect, it } from 'vitest';

import {
  makeAlertsPage,
  makeCohortReport,
  makeMenuReport,
  makeOperationsReport,
  makePrimeCostReport,
} from '@areas/admin/features/analytics/testing/analytics-testing';

import {
  alertsCsv,
  cohortCsv,
  menuEngineeringCsv,
  operationsCsv,
  primeCostCsv,
  toCsv,
} from './analytics-csv';

describe('toCsv', () => {
  it('uses CRLF and quotes commas, quotes and newlines', () => {
    const csv = toCsv<{ a: string; b: string }>(
      [
        { header: 'A', value: (row) => row.a },
        { header: 'B', value: (row) => row.b },
      ],
      [{ a: 'plain', b: 'a,b' }, { a: 'say "hi"', b: 'line\nbreak' }],
    );
    expect(csv).toBe('A,B\r\nplain,"a,b"\r\n"say ""hi""","line\nbreak"');
  });
});

describe('section exports', () => {
  it('exports one prime cost row per period with raw amounts', () => {
    const csv = primeCostCsv(makePrimeCostReport());
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Ventas netas');
    expect(lines[0]).toContain('Margen neto %');
    expect(lines[1]).toContain('2026-06');
    expect(lines[1]).toContain('240869900.00');
    expect(lines).toHaveLength(3);
  });

  it('exports menu items with quadrant', () => {
    const csv = menuEngineeringCsv(makeMenuReport());
    expect(csv.split('\r\n')[0]).toContain('Cuadrante');
    expect(csv).toContain('Pizza Especial Familiar');
    expect(csv).toContain('STAR');
  });

  it('exports operations metrics and day parts', () => {
    const csv = operationsCsv(makeOperationsReport());
    expect(csv).toContain('RevPASH');
    expect(csv).toContain('Rotacion LUNCH');
    expect(csv).toContain('Cubiertos DINNER');
  });

  it('exports cohort totals plus one row per bucket', () => {
    const csv = cohortCsv(makeCohortReport());
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Recurrencia %');
    expect(lines[1]).toContain('Total');
    expect(csv).toContain('TABLE_ONLY');
    expect(lines).toHaveLength(4);
  });

  it('exports one alert row per item', () => {
    const csv = alertsCsv(makeAlertsPage().items);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('Severidad');
    expect(lines[1]).toContain('FOOD_COST_DEVIATION');
    expect(lines[1]).toContain('2026-11-20T04:00:00Z');
    expect(lines).toHaveLength(3);
  });
});
