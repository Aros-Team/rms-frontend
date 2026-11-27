import { describe, expect, it } from 'vitest';

import { areaColorIndex, areaColorVar } from './area-colors';

describe('areaColorVar', () => {
  it('should map area ids to the eight categorical tokens', () => {
    expect(areaColorVar(1)).toBe('var(--rms-chart-1)');
    expect(areaColorVar(8)).toBe('var(--rms-chart-8)');
    expect(areaColorVar(9)).toBe('var(--rms-chart-1)');
    expect(areaColorIndex(9)).toBe(1);
  });

  it('should fall back safely for a missing area', () => {
    expect(areaColorVar(null)).toBe('var(--rms-chart-1)');
    expect(areaColorVar(0)).toBe('var(--rms-chart-1)');
  });
});
