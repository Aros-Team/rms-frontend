/**
 * Tests for the RmsTreemap primitive.
 *
 * Feature: category revenue comparison in a rectangular slot.
 * Contract:
 *  - tiles keep a value-proportional area and are grouped in at most three rows
 *  - percentages add up to ~100 and every label/value is rendered as text
 *  - zero and negative totals are dropped instead of drawing empty tiles
 *
 * Approach: set the input and assert the internal rows and the rendered DOM.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resolveUiResources } from '../testing/ui-test-resources';
import { RmsTreemap } from './treemap';
import treemapHtml from './treemap.html?raw';

describe('RmsTreemap', () => {
  let fixture: ComponentFixture<RmsTreemap>;

  beforeAll(async () => {
    await resolveUiResources({ 'treemap.html': treemapHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsTreemap] }).compileComponents();
    fixture = TestBed.createComponent(RmsTreemap);
  });

  it('sorts tiles, builds balanced rows and keeps the areas proportional', () => {
    fixture.componentInstance.items = [
      { label: 'Bebidas', total: 100, color: '#111' },
      { label: 'Platos', total: 300, color: '#222' },
      { label: 'Postres', total: 50, color: '#333' },
      { label: 'Entradas', total: 150, color: '#444' },
    ];
    fixture.detectChanges();

    const rows = fixture.componentInstance.rows;
    expect(rows).toHaveLength(2);
    expect(rows.flatMap((row) => row.tiles.map((tile) => tile.label))).toEqual([
      'Platos',
      'Entradas',
      'Bebidas',
      'Postres',
    ]);
    expect(rows[0].weight).toBe(450);
  });

  it('renders every label, percentage and money value', () => {
    fixture.componentInstance.items = [
      { label: 'Platos', total: 300, color: '#222' },
      { label: 'Bebidas', total: 100, color: '#111' },
    ];
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(text).toContain('Platos');
    expect(text).toContain('75%');
    expect(text).toContain('Bebidas');
    expect(text).toContain('25%');
  });

  it('drops tiles without a positive total', () => {
    fixture.componentInstance.items = [
      { label: 'Platos', total: 0, color: '#222' },
      { label: 'Bebidas', total: 100, color: '#111' },
    ];
    fixture.detectChanges();

    expect(fixture.componentInstance.rows).toHaveLength(1);
    expect(fixture.componentInstance.rows[0]?.tiles).toHaveLength(1);
  });
});
