/**
 * Tests for recipe-row validation and payload building.
 *
 * Feature: the recipe editor must block bad rows with a clear message while
 * still allowing a legitimately empty recipe.
 * Contract:
 *  - a missing ingredient, zero/negative/non-numeric quantity and more than
 *    three decimals are errors
 *  - duplicated ingredients are errors on every duplicate row
 *  - an unknown variant id is rejected
 *  - the payload only contains valid rows, in order, with numeric quantities
 *  - an empty recipe is valid (bottled drinks have no ingredients)
 *
 * Approach: pure functions with controlled row fixtures; assert the exact
 * message keys and payload array.
 */
import { describe, expect, it } from 'vitest';

import {
  MAX_RECIPE_QUANTITY,
  createRecipeRow,
  normalizeQuantityText,
  recipeRowsFromRecipe,
  recipeSnapshot,
  validateRecipeRows,
} from './recipe-rows';

const KNOWN = new Set([301, 302, 303]);

function row(supplyVariantId: number | null, quantity: string) {
  return createRecipeRow(supplyVariantId, quantity);
}

describe('validateRecipeRows', () => {
  it('accepts a valid recipe and builds the payload in order', () => {
    const result = validateRecipeRows([row(301, '0,5'), row(302, '2')], KNOWN);

    expect(result.valid).toBe(true);
    expect(result.issues.size).toBe(0);
    expect(result.payload).toEqual([
      { supplyVariantId: 301, requiredQuantity: 0.5 },
      { supplyVariantId: 302, requiredQuantity: 2 },
    ]);
  });

  it('accepts an empty recipe without errors', () => {
    const result = validateRecipeRows([], KNOWN);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.payload).toEqual([]);
  });

  it('flags a row without an ingredient', () => {
    const result = validateRecipeRows([row(null, '1')], KNOWN);
    expect(result.valid).toBe(false);
    const issues = [...result.issues.values()];
    expect(issues[0]?.variant).toBe('Selecciona un insumo');
  });

  it('flags zero and negative quantities', () => {
    const zero = validateRecipeRows([row(301, '0')], KNOWN);
    const negative = validateRecipeRows([row(301, '-2')], KNOWN);

    expect([...zero.issues.values()][0]?.quantity).toBe('La cantidad debe ser mayor que 0');
    expect([...negative.issues.values()][0]?.quantity).toBe('La cantidad debe ser mayor que 0');
  });

  it('flags a non-numeric quantity and keeps the row invalid', () => {
    const result = validateRecipeRows([row(301, 'dos')], KNOWN);
    expect([...result.issues.values()][0]?.quantity).toBe('Usa un número, por ejemplo 0,25');
    expect(result.payload).toEqual([]);
  });

  it('flags more than three decimals', () => {
    const result = validateRecipeRows([row(301, '0.1234')], KNOWN);
    expect([...result.issues.values()][0]?.quantity).toBe('Máximo 3 decimales');
  });

  it('flags quantities above the supported maximum', () => {
    const result = validateRecipeRows([row(301, String(MAX_RECIPE_QUANTITY + 1))], KNOWN);
    expect([...result.issues.values()][0]?.quantity).toBe(
      `La cantidad máxima es ${String(MAX_RECIPE_QUANTITY)}`,
    );
  });

  it('flags every duplicate row', () => {
    const result = validateRecipeRows([row(301, '1'), row(302, '1'), row(301, '2')], KNOWN);

    expect(result.valid).toBe(false);
    expect(result.duplicates.size).toBe(2);
    expect(result.errors[0]).toBe('Hay insumos repetidos en la receta.');
    for (const value of result.issues.values()) {
      if (value.variant.length > 0) {
        expect(value.variant).toBe('Insumo repetido: usa una sola fila');
      }
    }
  });

  it('rejects a variant that is not in the catalogue', () => {
    const result = validateRecipeRows([row(999, '1')], KNOWN);
    expect([...result.issues.values()][0]?.variant).toBe(
      'Insumo no disponible en el catálogo',
    );
  });

  it('summarizes the number of invalid rows', () => {
    const result = validateRecipeRows([row(null, '1'), row(301, '0')], KNOWN);
    expect(result.errors).toContain('Hay 2 filas con errores. Corrígelas antes de guardar.');
  });
});

describe('recipe serialization', () => {
  it('maps the API recipe to editable rows with three decimals', () => {
    const rows = recipeRowsFromRecipe([
      { supplyVariantId: 301, requiredQuantity: 0.5 },
      { supplyVariantId: 302, requiredQuantity: 1.0 },
    ]);

    expect(rows.map((item) => item.quantity)).toEqual(['0.5', '1']);
    expect(rows.map((item) => item.supplyVariantId)).toEqual([301, 302]);
  });

  it('treats "1,00" and "1" as the same draft value', () => {
    expect(normalizeQuantityText('1,00')).toBe('1');
    expect(recipeSnapshot([row(301, '1,00')])).toBe(recipeSnapshot([row(301, '1')]));
  });

  it('keeps a row order change as a real change', () => {
    expect(recipeSnapshot([row(301, '1'), row(302, '1')])).not.toBe(
      recipeSnapshot([row(302, '1'), row(301, '1')]),
    );
  });
});
