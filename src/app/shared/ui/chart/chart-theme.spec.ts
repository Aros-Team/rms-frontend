/**
 * Tests for the shared Chart.js theme.
 *
 * Feature: one palette/axis/tooltip/legend configuration for every chart.
 * Contract:
 *  - palette returns eight distinct colours
 *  - token reads fall back to literals when the DOM has no CSS variables
 *  - applying the defaults sets Archivo 12px, legend padding 16 and a 1px
 *    tooltip border, and disables animation under reduced motion
 *  - the registry contains only the controllers/scales/plugins the product
 *    renders, so `registerables` cannot creep back in
 *
 * Approach: pure function calls against the Chart.js defaults registry. jsdom
 * returns empty custom properties, which exercises the fallback path.
 */
import { Chart } from 'chart.js';

import {
  applyRmsChartDefaults,
  prefersReducedMotion,
  readRmsToken,
  rmsChartAxisColor,
  rmsChartPalette,
} from './chart-theme';

describe('rmsChart theme', () => {
  it('returns eight distinct series colours', () => {
    const palette = rmsChartPalette();

    expect(palette).toHaveLength(8);
    expect(new Set(palette).size).toBe(8);
  });

  it('falls back to a literal when a token is not defined', () => {
    expect(readRmsToken('--rms-does-not-exist', '#123456')).toBe('#123456');
  });

  it('applies the shared font, legend and tooltip defaults', () => {
    applyRmsChartDefaults();

    expect(Chart.defaults.font.family).toContain('Archivo');
    expect(Chart.defaults.font.size).toBe(12);
    expect(Chart.defaults.plugins.legend.labels.padding).toBe(16);
    expect(Chart.defaults.plugins.legend.labels.boxWidth).toBe(10);
    expect(Chart.defaults.plugins.tooltip.borderWidth).toBe(1);
    expect(Chart.defaults.plugins.tooltip.padding).toBe(12);
  });

  it('registers the controllers, scales and plugins the app renders', () => {
    applyRmsChartDefaults();

    for (const id of ['bar', 'line', 'doughnut', 'bubble']) {
      expect(Chart.registry.getController(id), id).toBeDefined();
    }
    for (const id of ['category', 'linear']) {
      expect(Chart.registry.getScale(id), id).toBeDefined();
    }
    for (const id of ['tooltip', 'legend', 'filler']) {
      expect(Chart.registry.getPlugin(id), id).toBeDefined();
    }
  });

  it('does not register unused controllers or scales', () => {
    applyRmsChartDefaults();

    // `getController`/`getScale` throw when the id is absent, which is the
    // public way to prove a component was not registered.
    for (const id of ['radar', 'polarArea', 'scatter']) {
      expect(() => Chart.registry.getController(id), id).toThrow();
    }
    for (const id of ['logarithmic', 'time', 'timeseries']) {
      expect(() => Chart.registry.getScale(id), id).toThrow();
    }
  });

  it('resolves the axis colour to a hex value', () => {
    expect(rmsChartAxisColor()).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('reports reduced motion from the media query', () => {
    expect(prefersReducedMotion()).toBe(false);
  });
});
