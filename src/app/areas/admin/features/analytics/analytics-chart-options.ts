import type { ChartOptions } from 'chart.js';

import {
  rmsBarOptions,
  rmsChartAxisColor,
  rmsDoughnutOptions,
  rmsLineOptions,
} from '@app/shared/ui/chart/chart-theme';

/**
 * Shared Chart.js option builders for the analytics workspace.
 *
 * They start from the DS builders (`rmsLineOptions` / `rmsBarOptions`) and only
 * add what analytics needs: labelled axes, compact money ticks and tooltips
 * that format the value with its unit instead of a raw float.
 */

const MONEY = new Intl.NumberFormat('es-CO', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

/** `$ 125 M` in the axis; tooltips use the full value. */
export function shortMoney(value: number | string): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  return `$ ${MONEY.format(amount)}`;
}

export function shortNumber(value: number | string): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (!Number.isFinite(amount)) return String(value);
  return NUMBER.format(amount);
}

export function formatPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

export function moneyLineOptions(unit: string): ChartOptions<'line'> {
  const base = rmsLineOptions();
  return {
    ...base,
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.['x'],
        ticks: { ...base.scales?.['x']?.ticks, color: rmsChartAxisColor() },
      },
      y: {
        ...base.scales?.['y'],
        title: { display: true, text: unit, color: rmsChartAxisColor() },
        ticks: { ...base.scales?.['y']?.ticks, callback: (value) => shortMoney(value) },
      },
    },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (item) => {
            const raw = item.parsed.y;
            const amount = typeof raw === 'number' ? raw : 0;
            return `${item.dataset.label ?? ''}: ${shortMoney(amount)}`;
          },
        },
      },
    },
  } as ChartOptions<'line'>;
}

export function percentLineOptions(unit = '%'): ChartOptions<'line'> {
  const base = rmsLineOptions();
  return {
    ...base,
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.['x'],
        ticks: { ...base.scales?.['x']?.ticks, color: rmsChartAxisColor() },
      },
      y: {
        ...base.scales?.['y'],
        title: { display: true, text: unit, color: rmsChartAxisColor() },
        ticks: {
          ...base.scales?.['y']?.ticks,
          callback: (value) => `${shortNumber(value)}%`,
        },
      },
    },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (item) => {
            const raw = item.parsed.y;
            const value = typeof raw === 'number' ? raw : 0;
            return `${item.dataset.label ?? ''}: ${formatPct(value, 2)}`;
          },
        },
      },
    },
  } as ChartOptions<'line'>;
}

export function moneyBarOptions(unit: string, stacked = false): ChartOptions<'bar'> {
  const base = rmsBarOptions();
  return {
    ...base,
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.['x'],
        stacked,
        ticks: { ...base.scales?.['x']?.ticks, color: rmsChartAxisColor() },
      },
      y: {
        ...base.scales?.['y'],
        stacked,
        title: { display: true, text: unit, color: rmsChartAxisColor() },
        ticks: { ...base.scales?.['y']?.ticks, callback: (value) => shortMoney(value) },
      },
    },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (item) => {
            const raw = item.parsed.y;
            const amount = typeof raw === 'number' ? raw : 0;
            return `${item.dataset.label ?? ''}: ${shortMoney(amount)}`;
          },
        },
      },
    },
  } as ChartOptions<'bar'>;
}

export function countBarOptions(unit: string, stacked = false): ChartOptions<'bar'> {
  const base = rmsBarOptions();
  return {
    ...base,
    scales: {
      ...base.scales,
      x: {
        ...base.scales?.['x'],
        stacked,
        ticks: { ...base.scales?.['x']?.ticks, color: rmsChartAxisColor() },
      },
      y: {
        ...base.scales?.['y'],
        stacked,
        title: { display: true, text: unit, color: rmsChartAxisColor() },
        ticks: { ...base.scales?.['y']?.ticks, callback: (value) => shortNumber(value) },
      },
    },
    plugins: {
      ...base.plugins,
      legend: { display: false },
      tooltip: {
        ...base.plugins?.tooltip,
        callbacks: {
          label: (item) => {
            const raw = item.parsed.y;
            const value = typeof raw === 'number' ? raw : 0;
            return `${item.dataset.label ?? ''}: ${shortNumber(value)}`;
          },
        },
      },
    },
  } as ChartOptions<'bar'>;
}

export function doughnutOptions(): ChartOptions<'doughnut'> {
  return rmsDoughnutOptions();
}

export function bubbleOptions(): ChartOptions<'bubble'> {
  const base = rmsBarOptions();
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'Ganancia por unidad (COP)', color: rmsChartAxisColor() },
        ticks: { ...base.scales?.['x']?.ticks, callback: (value) => shortMoney(value) },
        grid: { color: base.scales?.['x']?.grid?.color },
      },
      y: {
        type: 'linear',
        beginAtZero: true,
        title: { display: true, text: 'Unidades vendidas', color: rmsChartAxisColor() },
        ticks: { ...base.scales?.['y']?.ticks, callback: (value) => shortNumber(value) },
        grid: { color: base.scales?.['y']?.grid?.color },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (item) => {
            const point = item.raw as { name?: string; x?: number; y?: number };
            return `${point.name ?? ''}: ${shortNumber(point.y ?? 0)} uds · ${shortMoney(point.x ?? 0)}`;
          },
        },
      },
    },
  } as ChartOptions<'bubble'>;
}
