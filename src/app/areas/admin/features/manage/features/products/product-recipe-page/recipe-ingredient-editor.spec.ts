/**
 * Tests for the recipe ingredient editor.
 *
 * Feature: search the supply-variant catalogue, add/remove rows and edit the
 * quantity with validation, without saving anything.
 * Contract:
 *  - suggestions exclude variants already in the recipe and respect the
 *    category filter; Enter adds the first suggestion
 *  - adding emits a row with quantity 1 and clears the search
 *  - editing the quantity emits the raw text (a comma stays a comma) so an
 *    invalid value is never silently coerced
 *  - zero/negative quantities render an inline alert
 *  - a variant without unit cost is labelled instead of showing $0
 *  - an empty recipe shows the empty state and its action focuses the search
 *  - disabled mode avoids emitting changes
 *
 * Approach: mount the standalone editor with the real primitives whose
 * templates are resolved through ?raw imports, then drive inputs/outputs and
 * assert both the emitted rows and the rendered messages.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecipeIngredientEditor, type RecipeVariantView } from './recipe-ingredient-editor';
import { createRecipeRow, type RecipeRow } from './recipe-rows';

import editorHtml from './recipe-ingredient-editor.html?raw';
import inputHtml from '@app/shared/ui/input/input.html?raw';
import fieldHtml from '@app/shared/ui/field/field.html?raw';
import selectHtml from '@app/shared/ui/select/select.html?raw';
import emptyStateHtml from '@app/shared/ui/empty-state/empty-state.html?raw';
import buttonHtml from '@app/shared/ui/button/button.html?raw';
import iconButtonHtml from '@app/shared/ui/icon-button/icon-button.html?raw';
import badgeHtml from '@app/shared/ui/badge/badge.html?raw';

function variant(
  id: number,
  supplyName: string,
  categoryId = 1,
  categoryName = 'Verduras',
  unitCost = '2000.00',
): RecipeVariantView {
  return {
    id,
    supplyName,
    categoryId,
    categoryName,
    unitAbbreviation: 'kg',
    quantity: 1,
    unitCost: { amount: unitCost, currency: 'COP' },
    displayName: `${supplyName} — 1 kg`,
  };
}

const VARIANTS = [
  variant(301, 'Tomate'),
  variant(302, 'Cebolla'),
  variant(303, 'Queso', 2, 'Lácteos', '9000.00'),
];

describe('RecipeIngredientEditor', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      const resources: Record<string, string> = {
        'recipe-ingredient-editor.html': editorHtml as unknown as string,
        'input.html': inputHtml as unknown as string,
        'field.html': fieldHtml as unknown as string,
        'select.html': selectHtml as unknown as string,
        'empty-state.html': emptyStateHtml as unknown as string,
        'button.html': buttonHtml as unknown as string,
        'icon-button.html': iconButtonHtml as unknown as string,
        'badge.html': badgeHtml as unknown as string,
      };
      for (const [name, content] of Object.entries(resources)) {
        if (url.endsWith(name)) return Promise.resolve(content);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  function mount(rows: RecipeRow[], variants: RecipeVariantView[] = VARIANTS) {
    TestBed.configureTestingModule({ imports: [RecipeIngredientEditor] });
    const fixture = TestBed.createComponent(RecipeIngredientEditor);
    fixture.componentInstance.rows = rows;
    fixture.componentInstance.variants = variants;
    fixture.detectChanges();
    return fixture;
  }

  function rowsOf(fixture: ComponentFixture<RecipeIngredientEditor>): RecipeRow[] {
    return fixture.componentInstance.rows;
  }

  function results(fixture: ComponentFixture<RecipeIngredientEditor>): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[data-recipe-result]',
      ),
    );
  }

  it('renders one row per recipe item with its unit', () => {
    const fixture = mount([createRecipeRow(301, '0.5'), createRecipeRow(303, '2')]);
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.ingredient-table tbody tr',
    );
    const units = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.ingredient-table tbody .ingredient-table__unit',
      ),
    ).map((cell) => cell.textContent.trim());

    expect(rows.length).toBe(2);
    expect(units).toEqual(['1 kg', '1 kg']);
  });

  it('excludes ingredients already in the recipe from the search results', () => {
    const fixture = mount([createRecipeRow(301, '1')]);
    fixture.componentInstance.onSearch('tomate');
    fixture.detectChanges();

    expect(results(fixture)).toHaveLength(0);
  });

  it('adds the first suggestion when Enter is pressed', () => {
    const fixture = mount([]);
    const emitted = vi.fn();
    fixture.componentInstance.rowsChange.subscribe(emitted);

    fixture.componentInstance.onSearch('tomate');
    fixture.detectChanges();
    fixture.componentInstance.onSearchKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(emitted).toHaveBeenCalledTimes(1);
    const rows = emitted.mock.calls[0]?.[0] as RecipeRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0].supplyVariantId).toBe(301);
    expect(rows[0].quantity).toBe('1');
    expect(fixture.componentInstance.search()).toBe('');
  });

  it('adds a suggestion with quantity 1 and clears the search', () => {
    const fixture = mount([]);
    const emitted = vi.fn();
    fixture.componentInstance.rowsChange.subscribe(emitted);
    fixture.componentInstance.onSearch('cebolla');
    fixture.detectChanges();

    results(fixture)[0].click();

    const rows = emitted.mock.calls[0]?.[0] as RecipeRow[];
    expect(rows[0].supplyVariantId).toBe(302);
    expect(rows[0].quantity).toBe('1');
    expect(fixture.componentInstance.search()).toBe('');
  });

  it('emits the typed quantity text unchanged', () => {
    const rows = [createRecipeRow(301, '1')];
    const fixture = mount(rows);
    const emitted = vi.fn();
    fixture.componentInstance.rowsChange.subscribe(emitted);

    fixture.componentInstance.onQuantityInput(rows[0], '0,25');

    const next = emitted.mock.calls[0]?.[0] as RecipeRow[];
    expect(next[0]?.quantity).toBe('0,25');
  });

  it('shows an inline error for a zero quantity', () => {
    const fixture = mount([createRecipeRow(301, '0')], VARIANTS);
    const alert = (fixture.nativeElement as HTMLElement).querySelector('.rms-field__error');

    expect(alert?.textContent.trim()).toBe('La cantidad debe ser mayor que 0');
    expect(fixture.componentInstance.validation().valid).toBe(false);
  });

  it('removes only the requested row', () => {
    const first = createRecipeRow(301, '1');
    const second = createRecipeRow(303, '1');
    const fixture = mount([first, second]);
    const emitted = vi.fn();
    fixture.componentInstance.rowsChange.subscribe(emitted);

    fixture.componentInstance.removeRow(first);

    const next = emitted.mock.calls[0]?.[0] as RecipeRow[];
    expect(next).toHaveLength(1);
    expect(next[0]?.key).toBe(second.key);
  });

  it('labels a variant without unit cost instead of showing a zero cost', () => {
    const fixture = mount([createRecipeRow(301, '1')], [variant(301, 'Tomate', 1, 'Verduras', '')]);
    const badge = (fixture.nativeElement as HTMLElement).querySelector(
      '.ingredient-table__numeric .rms-badge__label',
    );

    expect(badge?.textContent.trim()).toBe('Sin costo unitario');
    expect(fixture.componentInstance.hasMissingCost(rowsOf(fixture)[0])).toBe(true);
  });

  it('shows the empty state and focuses the search from its action', () => {
    const fixture = mount([]);
    const empty = (fixture.nativeElement as HTMLElement).querySelector('app-rms-empty-state');
    expect(empty?.textContent).toContain('Sin insumos en la receta');

    const focus = vi.spyOn(fixture.componentInstance, 'focusSearch');
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('app-rms-empty-state button')
      ?.click();
    fixture.detectChanges();

    const input = (fixture.nativeElement as HTMLElement).querySelector('input');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
  });

  it('filters suggestions by supply category when there is no search text', () => {
    const fixture = mount([]);
    fixture.componentInstance.onCategoryChange(2);
    fixture.detectChanges();

    const buttons = results(fixture);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toContain('Queso');
  });

  it('does not emit changes while disabled', () => {
    const rows = [createRecipeRow(301, '1')];
    const fixture = mount(rows);
    fixture.componentInstance.disabled = true;
    fixture.detectChanges();
    const emitted = vi.fn();
    fixture.componentInstance.rowsChange.subscribe(emitted);

    fixture.componentInstance.onSearch('cebolla');
    fixture.detectChanges();
    fixture.componentInstance.addFirstSuggestion();
    fixture.componentInstance.removeRow(rows[0]);

    expect(emitted).not.toHaveBeenCalled();
  });
});
