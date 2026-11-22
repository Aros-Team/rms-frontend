/**
 * Editable recipe rows and their validation.
 *
 * The API stores a recipe as a list of `{ supplyVariantId, requiredQuantity }`
 * (quantity in the variant's own unit, 3 decimals). The page keeps the raw
 * text the user typed so an invalid value is never silently coerced to 0 or 1,
 * and derives the request payload only from rows that validate.
 */
import { decimalToScaled, parseDecimal } from './recipe-costing';

/** Editable row. `key` is stable for `@for` tracking and error lookup. */
export interface RecipeRow {
  key: number;
  supplyVariantId: number | null;
  /** Raw text from the quantity input (`"0,25"`, `"1"`, `""`). */
  quantity: string;
}

export interface RecipeRowIssues {
  variant: string;
  quantity: string;
}

/** Request item shape accepted by `PUT /v1/products/{id}` and product options. */
export interface RecipePayloadItem {
  supplyVariantId: number;
  requiredQuantity: number;
}

export interface RecipeValidation {
  /** Keyed by row key; rows without problems are absent. */
  issues: ReadonlyMap<number, RecipeRowIssues>;
  /** Keys of rows whose variant appears more than once. */
  duplicates: ReadonlySet<number>;
  /** Human-readable summary shown above the editor. */
  errors: string[];
  /** Rows that can be sent to the API, in order. */
  payload: RecipePayloadItem[];
  valid: boolean;
}

/** Matches `DECIMAL(10,3)` — a portion beyond 1 kg is a data-entry mistake. */
export const MAX_RECIPE_QUANTITY = 10_000;

const EMPTY_ISSUES: RecipeRowIssues = { variant: '', quantity: '' };
let rowSequence = 0;

/** Stable, process-wide row key (keys never need to be persisted). */
export function nextRecipeRowKey(): number {
  rowSequence += 1;
  return rowSequence;
}

export function createRecipeRow(
  supplyVariantId: number | null = null,
  quantity = '1',
): RecipeRow {
  return { key: nextRecipeRowKey(), supplyVariantId, quantity };
}

/** Maps an API recipe to editable rows, formatting quantities for the inputs. */
export function recipeRowsFromRecipe(
  recipe: readonly { supplyVariantId: number; requiredQuantity: number }[],
): RecipeRow[] {
  return recipe.map((item) =>
    createRecipeRow(item.supplyVariantId, String(Number(item.requiredQuantity.toFixed(3)))),
  );
}

/** Canonical text used for dirty-state comparison (`"1,00"` and `"1"` match). */
export function normalizeQuantityText(value: string): string {
  const parsed = parseDecimal(value);
  if (parsed === null) return value.trim();
  return String(Number(parsed.toFixed(3)));
}

/** Serializes the editable draft for the unsaved-changes comparison. */
export function recipeSnapshot(rows: readonly RecipeRow[]): string {
  return JSON.stringify(
    rows.map((row) => ({
      variant: row.supplyVariantId,
      quantity: normalizeQuantityText(row.quantity),
    })),
  );
}

/**
 * Validates the recipe rows. An empty recipe is **valid**: several products
 * (bottled drinks) have no ingredients, so the UI warns instead of blocking.
 */
export function validateRecipeRows(
  rows: readonly RecipeRow[],
  knownVariantIds: ReadonlySet<number>,
): RecipeValidation {
  const issues = new Map<number, RecipeRowIssues>();
  const duplicates = new Set<number>();
  const variantCounts = new Map<number, number[]>();

  for (const row of rows) {
    if (row.supplyVariantId !== null) {
      const previous = variantCounts.get(row.supplyVariantId) ?? [];
      previous.push(row.key);
      variantCounts.set(row.supplyVariantId, previous);
    }
  }
  for (const keys of variantCounts.values()) {
    if (keys.length > 1) {
      for (const key of keys) duplicates.add(key);
    }
  }

  const payload: RecipePayloadItem[] = [];

  for (const row of rows) {
    const rowIssues: RecipeRowIssues = { variant: '', quantity: '' };

    if (row.supplyVariantId === null) {
      rowIssues.variant = 'Selecciona un insumo';
    } else if (!knownVariantIds.has(row.supplyVariantId)) {
      rowIssues.variant = 'Insumo no disponible en el catálogo';
    } else if (duplicates.has(row.key)) {
      rowIssues.variant = 'Insumo repetido: usa una sola fila';
    }

    const rawQuantity = row.quantity.trim();
    const parsedQuantity = parseDecimal(rawQuantity);

    if (rawQuantity.length === 0) {
      rowIssues.quantity = 'Indica una cantidad';
    } else if (parsedQuantity === null) {
      rowIssues.quantity = 'Usa un número, por ejemplo 0,25';
    } else if (parsedQuantity <= 0) {
      rowIssues.quantity = 'La cantidad debe ser mayor que 0';
    } else if (parsedQuantity > MAX_RECIPE_QUANTITY) {
      rowIssues.quantity = `La cantidad máxima es ${String(MAX_RECIPE_QUANTITY)}`;
    } else if (decimalToScaled(rawQuantity, 3) === null) {
      rowIssues.quantity = 'Máximo 3 decimales';
    }

    if (rowIssues.variant.length > 0 || rowIssues.quantity.length > 0) {
      issues.set(row.key, rowIssues);
    }

    if (
      row.supplyVariantId !== null &&
      parsedQuantity !== null &&
      parsedQuantity > 0 &&
      parsedQuantity <= MAX_RECIPE_QUANTITY &&
      decimalToScaled(rawQuantity, 3) !== null
    ) {
      payload.push({
        supplyVariantId: row.supplyVariantId,
        requiredQuantity: parsedQuantity,
      });
    }
  }

  const errors: string[] = [];
  if (duplicates.size > 0) {
    errors.push('Hay insumos repetidos en la receta.');
  }
  if (issues.size > 0) {
    const count = issues.size;
    errors.push(
      count === 1
        ? 'Hay 1 fila con errores. Corrígela antes de guardar.'
        : `Hay ${String(count)} filas con errores. Corrígelas antes de guardar.`,
    );
  }

  return { issues, duplicates, errors, payload, valid: issues.size === 0 };
}

/** Issues for a row (`''` fields when the row is fine). */
export function issuesForRow(
  validation: RecipeValidation,
  row: RecipeRow,
): RecipeRowIssues {
  return validation.issues.get(row.key) ?? EMPTY_ISSUES;
}
