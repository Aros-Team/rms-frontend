/** Eight available categorical tokens. */
const CHART_TOKEN_COUNT = 8;

/** Stable categorical index (1..8) derived from an area id. */
export function areaColorIndex(areaId: number | null | undefined): number {
  if (areaId === null || areaId === undefined || areaId < 1) {
    return 1;
  }
  return ((Math.trunc(areaId) - 1) % CHART_TOKEN_COUNT) + 1;
}

/**
 * Stable color token for an area.
 *
 * The color is derived from the area id, never persisted, and uses the
 * theme-aware `--rms-chart-*` categorical palette.
 */
export function areaColorVar(areaId: number | null | undefined): string {
  return `var(--rms-chart-${String(areaColorIndex(areaId))})`;
}
