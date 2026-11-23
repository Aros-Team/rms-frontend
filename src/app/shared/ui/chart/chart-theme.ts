import {
  ArcElement,
  BarController,
  BarElement,
  BubbleController,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js';

/**
 * One Chart.js configuration for the product.
 *
 * - Fonts: Archivo 12px, axis labels in `--rms-text-muted`.
 * - Grid: 1px `--rms-border`, no gridline on the category axis.
 * - Tooltip: surface background, text colour, 1px border, 12px padding.
 * - Legend: HTML below the plot is the rule; when a canvas legend is used it
 *   is 12px, 10x10 swatches with 16px padding (never absolute over a table).
 * - Animation: 240ms on first render, none on resize, none under reduced motion.
 *
 * Colours are read from CSS tokens at call time, so light, dark and high
 * contrast follow the DOM with no duplicated palette in TypeScript.
 *
 * Usage: feature lanes call `applyRmsChartDefaults()` once (ChartFrame does it)
 * and build options with `rmsLineOptions()` / `rmsBarOptions()` /
 * `rmsDoughnutOptions()`.
 */

const FALLBACKS_LIGHT = [
  '#1d4ed8',
  '#0f766e',
  '#6d28d9',
  '#be185d',
  '#b45309',
  '#4d7c0f',
  '#475569',
  '#9f1239',
];

const FALLBACKS_DARK = [
  '#60a5fa',
  '#2dd4bf',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#a3e635',
  '#94a3b8',
  '#fb7185',
];

let registered = false;

function isDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/** Reads a CSS custom property, falling back to a literal when unset (tests). */
export function readRmsToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value.length > 0 ? value : fallback;
}

/** The eight categorical series colours for the active theme. */
export function rmsChartPalette(): string[] {
  const fallbacks = isDark() ? FALLBACKS_DARK : FALLBACKS_LIGHT;
  return fallbacks.map((fallback, index) => readRmsToken(`--rms-chart-${String(index + 1)}`, fallback));
}

export function rmsChartAxisColor(): string {
  return readRmsToken('--rms-chart-axis', isDark() ? '#94a3b8' : '#64748b');
}

export function rmsChartGridColor(): string {
  return readRmsToken('--rms-chart-grid', isDark() ? '#334155' : '#e2e8f0');
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Applies the global Chart.js defaults. Idempotent: calling it on every chart
 * is safe, and it re-reads the theme so a chart created after a theme switch
 * gets the right colours.
 */
export function applyRmsChartDefaults(): void {
  if (!registered) {
    // Only what the product renders: bar, line, doughnut and bubble. The
    // legacy `registerables` also pulled radar, polarArea, scatter, the
    // logarithmic/time scales and every plugin into the chunk.
    // `Filler` is required by the prime-cost area chart (`fill: true`).
    Chart.register(
      BarController,
      LineController,
      DoughnutController,
      BubbleController,
      BarElement,
      LineElement,
      PointElement,
      ArcElement,
      CategoryScale,
      LinearScale,
      Tooltip,
      Legend,
      Filler,
    );
    registered = true;
  }

  const axis = rmsChartAxisColor();
  const grid = rmsChartGridColor();

  Chart.defaults.font.family = readRmsToken('--rms-font-sans', 'Archivo, sans-serif');
  Chart.defaults.font.size = 12;
  Chart.defaults.color = axis;
  Chart.defaults.borderColor = grid;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;

  if (prefersReducedMotion()) {
    Chart.defaults.animation = false;
  } else {
    (Chart.defaults.animation as { duration?: number }).duration = 240;
  }

  const legend = Chart.defaults.plugins.legend;
  legend.position = 'bottom';
  legend.labels.boxWidth = 10;
  legend.labels.boxHeight = 10;
  legend.labels.padding = 16;
  legend.labels.usePointStyle = false;
  legend.labels.color = readRmsToken(
    '--rms-chart-legend-text',
    isDark() ? '#cbd5e1' : '#475569',
  );
  legend.labels.font = { size: 12 };

  const tooltip = Chart.defaults.plugins.tooltip;
  tooltip.backgroundColor = readRmsToken(
    '--rms-chart-tooltip-bg',
    isDark() ? '#1e293b' : '#ffffff',
  );
  tooltip.titleColor = readRmsToken('--rms-chart-tooltip-text', isDark() ? '#e2e8f0' : '#0f172a');
  tooltip.bodyColor = readRmsToken('--rms-chart-tooltip-text', isDark() ? '#e2e8f0' : '#0f172a');
  tooltip.borderColor = readRmsToken(
    '--rms-chart-tooltip-border',
    isDark() ? '#475569' : '#cbd5e1',
  );
  tooltip.borderWidth = 1;
  tooltip.padding = 12;
  tooltip.cornerRadius = 8;
}

export interface RmsChartOptionsInput {
  /** Canvas legend. HTML legends are preferred; canvas is opt-in. */
  legend?: boolean;
  legendPosition?: 'top' | 'bottom';
}

function basePlugins(input: RmsChartOptionsInput): ChartOptions['plugins'] {
  return {
    legend: {
      display: input.legend ?? false,
      position: input.legendPosition ?? 'bottom',
      labels: { boxWidth: 10, boxHeight: 10, padding: 16, usePointStyle: false },
    },
    tooltip: {
      displayColors: true,
    },
  };
}

function axisOptions() {
  return {
    grid: {
      color: rmsChartGridColor(),
      drawTicks: false,
    },
    border: {
      display: false,
    },
    ticks: {
      color: rmsChartAxisColor(),
      font: { size: 12 },
      padding: 8,
    },
  };
}

/** Line/area options: category axis has no gridline, value axis keeps them. */
export function rmsLineOptions(input: RmsChartOptionsInput = {}): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: basePlugins(input),
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { ...axisOptions(), grid: { display: false }, border: { display: true } },
      y: { ...axisOptions(), beginAtZero: true },
    },
  };
}

/** Bar options: the same axis rules, grouped bars by default. */
export function rmsBarOptions(input: RmsChartOptionsInput = {}): ChartOptions<'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: basePlugins(input),
    scales: {
      x: { ...axisOptions(), grid: { display: false }, border: { display: true } },
      y: { ...axisOptions(), beginAtZero: true },
    },
  };
}

/** Doughnut options: no scales, legend padding ready for a canvas fallback. */
export function rmsDoughnutOptions(input: RmsChartOptionsInput = {}): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      ...basePlugins(input),
      tooltip: {
        displayColors: true,
      },
    },
  };
}
