import type { CohortReport } from '@app/shared/models/dto/analytics/cohort-report';
import type { MenuEngineeringReport } from '@app/shared/models/dto/analytics/menu-engineering-report';
import type { OperationsReport } from '@app/shared/models/dto/analytics/operations-report';
import type {
  PrimeCostCogsBreakdownRow,
  PrimeCostLaborBreakdownRow,
  PrimeCostReport,
} from '@app/shared/models/dto/analytics/prime-cost-report';
import type { SystemAlert } from '@app/shared/models/dto/analytics/system-alert';

/**
 * CSV export for every analytics section.
 *
 * Export uses the data already on screen — no extra HTTP call. Amounts are
 * written as the raw decimal string from the wire so a spreadsheet keeps the
 * exact value; percentages stay numeric. `toCsv` is pure and unit-tested;
 * `downloadCsv` is the only DOM-touching part.
 */

export type CsvValue = string | number | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

const NEEDS_QUOTES = /[",\n\r]/;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Builds an RFC-4180 CSV document (CRLF line endings, quoted when needed). */
export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]): string {
  const header = columns.map((column) => cell(column.header)).join(',');
  const body = rows.map((row) => columns.map((column) => cell(column.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

/** Triggers a browser download. No-op outside a DOM (unit tests). */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  if (typeof URL.createObjectURL !== 'function') return;

  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}

const money = (value: { amount: string } | null | undefined): string =>
  value === null || value === undefined ? '' : value.amount;

const number = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? '' : String(value);

/** One row per period bucket, with money and margin columns. */
export function primeCostCsv(report: PrimeCostReport): string {
  const columns: CsvColumn<(typeof report.series)[number]>[] = [
    { header: 'Periodo', value: (row) => row.key },
    { header: 'Ventas brutas', value: (row) => money(row.grossSales) },
    { header: 'Descuentos', value: (row) => money(row.discounts) },
    { header: 'Consumo del personal', value: (row) => money(row.comped) },
    { header: 'Ventas netas', value: (row) => money(row.netSales) },
    { header: 'COGS', value: (row) => money(row.cogs.total) },
    { header: 'Nomina', value: (row) => money(row.labor.total) },
    { header: 'Costo primo', value: (row) => money(row.primeCost) },
    { header: 'Costo primo %', value: (row) => number(row.primeCostPct) },
    { header: 'Margen bruto %', value: (row) => number(row.margins?.grossProfitPct) },
    { header: 'Margen neto %', value: (row) => number(row.margins?.netProfitPct) },
    { header: 'Completitud', value: (row) => row.dataCompleteness },
  ];
  return toCsv(columns, report.series);
}

function cogsAmount(
  row: { cogs: { byCategory: PrimeCostCogsBreakdownRow[] } },
  category: string,
): string {
  return money(row.cogs.byCategory.find((line) => line.category === category)?.amount);
}

function laborAmount(
  row: { labor: { byArea: PrimeCostLaborBreakdownRow[] } },
  area: string,
): string {
  return money(row.labor.byArea.find((line) => line.area === area)?.amount);
}

/** One row per period bucket with the category breakdown as columns. */
export function primeCostCategoryCsv(report: PrimeCostReport): string {
  const columns: CsvColumn<(typeof report.series)[number]>[] = [
    { header: 'Periodo', value: (row) => row.key },
    { header: 'Comidas', value: (row) => cogsAmount(row, 'FOOD') },
    { header: 'Bebidas', value: (row) => cogsAmount(row, 'BEVERAGE') },
    { header: 'Licores', value: (row) => cogsAmount(row, 'ALCOHOL') },
    { header: 'Otros COGS', value: (row) => cogsAmount(row, 'OTHER') },
    { header: 'Salon', value: (row) => laborAmount(row, 'FOH') },
    { header: 'Cocina', value: (row) => laborAmount(row, 'BOH') },
    { header: 'Otros nomina', value: (row) => laborAmount(row, 'OTHER') },
  ];
  return toCsv(columns, report.series);
}

/** One row per menu item. */
export function menuEngineeringCsv(report: MenuEngineeringReport): string {
  const columns: CsvColumn<(typeof report.items)[number]>[] = [
    { header: 'Producto', value: (row) => row.productName },
    { header: 'Categoria', value: (row) => row.categoryName },
    { header: 'Unidades', value: (row) => row.unitsSold },
    { header: 'Ingresos', value: (row) => money(row.revenue) },
    { header: 'Costo receta', value: (row) => money(row.recipeCost) },
    { header: 'Costo opciones', value: (row) => money(row.avgOptionCost) },
    { header: 'Costo efectivo', value: (row) => money(row.effectiveCost) },
    { header: 'Ganancia por unidad', value: (row) => money(row.grossProfitPerUnit) },
    { header: 'Contribucion total', value: (row) => money(row.totalContribution) },
    { header: 'Cuadrante', value: (row) => row.quadrant },
  ];
  return toCsv(columns, report.items);
}

interface MetricRow {
  metric: string;
  value: string;
  unit: string;
}

/** Overall metrics plus one block per day part. */
export function operationsCsv(report: OperationsReport): string {
  const rows: MetricRow[] = [
    { metric: 'RevPASH', value: money(report.revPash.value), unit: 'COP / hora-asiento' },
    { metric: 'Ventas netas', value: money(report.revPash.totalNetSales), unit: 'COP' },
    {
      metric: 'Horas-asiento disponibles',
      value: number(report.revPash.totalAvailableSeatHours),
      unit: 'horas',
    },
    { metric: 'Cubiertos', value: String(report.covers), unit: 'cubiertos' },
    { metric: 'Pedidos', value: String(report.orders), unit: 'pedidos' },
    { metric: 'Rotacion global', value: number(report.tableTurnover.overall), unit: 'turnos' },
    { metric: 'Ocupacion media', value: number(report.avgOccupancyMinutes), unit: 'minutos' },
    { metric: 'Nomina', value: money(report.labor.totalCost), unit: 'COP' },
    { metric: 'Participacion nomina', value: number(report.labor.sharePct), unit: '%' },
  ];

  for (const dayPart of report.tableTurnover.byDayPart) {
    rows.push({
      metric: `Rotacion ${dayPart.dayPart}`,
      value: number(dayPart.turns),
      unit: 'turnos',
    });
    rows.push({
      metric: `Cubiertos ${dayPart.dayPart}`,
      value: String(dayPart.covers),
      unit: 'cubiertos',
    });
    rows.push({
      metric: `Mesas ${dayPart.dayPart}`,
      value: String(dayPart.tables),
      unit: 'mesas',
    });
  }

  return toCsv<MetricRow>(
    [
      { header: 'Metrica', value: (row) => row.metric },
      { header: 'Valor', value: (row) => row.value },
      { header: 'Unidad', value: (row) => row.unit },
    ],
    rows,
  );
}

/** Overall totals plus one row per cohort window. */
export function cohortCsv(report: CohortReport): string {
  interface Row {
    key: string;
    newClients: number;
    recurringClients: number;
    totalOrders: number;
    recurringRatePct: number;
  }
  const rows: Row[] = [
    {
      key: 'Total',
      newClients: report.newClients,
      recurringClients: report.recurringClients,
      totalOrders: report.totalOrders,
      recurringRatePct: report.recurringRatePct,
    },
    ...report.cohorts,
  ];

  return toCsv<Row>(
    [
      { header: 'Periodo', value: (row) => row.key },
      { header: 'Nuevos', value: (row) => row.newClients },
      { header: 'Recurrentes', value: (row) => row.recurringClients },
      { header: 'Pedidos', value: (row) => row.totalOrders },
      { header: 'Recurrencia %', value: (row) => number(row.recurringRatePct) },
      { header: 'Ticket por pedido', value: () => money(report.averageTicketPerOrder) },
      { header: 'Ticket por cubierto', value: () => money(report.averageTicketPerCover) },
      { header: 'Estrategia', value: () => report.fingerprintStrategy },
    ],
    rows,
  );
}

/** One row per alert. */
export function alertsCsv(alerts: readonly SystemAlert[]): string {
  return toCsv<SystemAlert>(
    [
      { header: 'ID', value: (row) => row.id },
      { header: 'Severidad', value: (row) => row.severity },
      { header: 'Tipo', value: (row) => row.type },
      { header: 'Mensaje', value: (row) => row.message },
      { header: 'Metrica', value: (row) => row.metric },
      { header: 'Linea base', value: (row) => row.baseline },
      { header: 'Actual', value: (row) => row.current },
      { header: 'Desviacion %', value: (row) => row.deviationPct },
      { header: 'Periodo', value: (row) => row.period },
      { header: 'Detectada', value: (row) => row.detectedAt },
      { header: 'Estado', value: (row) => row.status },
    ],
    alerts,
  );
}
