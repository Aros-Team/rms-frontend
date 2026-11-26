/**
 * Tests for the shared analytics chart palette mapping.
 *
 * Feature: every analytics module reads the same semantic colour roles.
 * Contract:
 *  - sales, cost, margin, COGS and labor roles keep their fixed series
 *  - the retired terracotta and neutral-gray values never come back
 *  - the dashboard and the analytics pages resolve the same chart ramp
 */
import { describe, expect, it } from 'vitest';

import { rmsChartPalette } from '@app/shared/ui/chart/chart-theme';

import { analyticsSeriesColors } from './analytics-chart-options';

const RETIRED = ['#b45309', '#475569'];

describe('analyticsSeriesColors', () => {
  it('maps each semantic role to the shared chart palette', () => {
    const palette = rmsChartPalette();
    const colors = analyticsSeriesColors();

    expect(colors.netSales).toBe(palette[0]);
    expect(colors.grossSales).toBe(palette[6]);
    expect(colors.primeCost).toBe(palette[3]);
    expect(colors.grossMargin).toBe(palette[1]);
    expect(colors.netMargin).toBe(palette[2]);
    expect(colors.cogs).toEqual({
      FOOD: palette[4],
      BEVERAGE: palette[0],
      ALCOHOL: palette[3],
      OTHER: palette[5],
    });
    expect(colors.labor).toEqual({
      FOH: palette[1],
      BOH: palette[2],
      OTHER: palette[6],
    });
    expect(colors.cohort).toEqual({ new: palette[0], recurring: palette[1] });
  });

  it('does not use the retired terracotta or slate-gray values', () => {
    const used = [
      ...rmsChartPalette(),
      ...Object.values(analyticsSeriesColors().cogs),
      ...Object.values(analyticsSeriesColors().labor),
    ].map((color) => color.toLowerCase());

    for (const retired of RETIRED) {
      expect(used).not.toContain(retired);
    }
  });
});
