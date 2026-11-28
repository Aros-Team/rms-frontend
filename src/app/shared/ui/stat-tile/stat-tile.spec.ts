/**
 * Tests for the RmsStatTile primitive.
 *
 * Feature: KPI value with label, period qualifier and delta.
 * Contract:
 *  - a null/empty value renders an em dash, never a fabricated zero
 *  - zero renders as "0"
 *  - the delta tone drives the arrow and the class
 *  - loading replaces the value with a status skeleton
 *
 * Approach: TestBed render with inputs set before the first check.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsStatTile, type RmsDeltaTone } from './stat-tile';
import { resolveUiResources } from '../testing/ui-test-resources';
import statTileHtml from './stat-tile.html?raw';
import skeletonHtml from '../skeleton/skeleton.html?raw';

describe('RmsStatTile', () => {
  let fixture: ComponentFixture<RmsStatTile>;

  beforeAll(async () => {
    await resolveUiResources({
      'stat-tile.html': statTileHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
    });
  });

  function create(value: string | number | null, deltaTone: RmsDeltaTone = 'neutral'): void {
    fixture = TestBed.createComponent(RmsStatTile);
    const tile = fixture.componentInstance;
    tile.label = 'Ventas netas';
    tile.value = value;
    tile.period = 'Último mes';
    tile.delta = '12,4 %';
    tile.deltaTone = deltaTone;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsStatTile] }).compileComponents();
    create(null);
  });

  it('renders an em dash when there is no value', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-stat__value')?.textContent.trim(),
    ).toBe('—');
  });

  it('renders zero as a real value', () => {
    fixture.destroy();
    create(0);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-stat__value')?.textContent.trim(),
    ).toBe('0');
  });

  it('renders the period qualifier', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-stat__period')?.textContent.trim(),
    ).toBe('Último mes');
  });

  it('maps the delta tone to the arrow and class', () => {
    fixture.destroy();
    create('12,4 %', 'positive');
    const delta = (fixture.nativeElement as HTMLElement).querySelector('.rms-stat__delta');

    expect(delta?.classList.contains('rms-stat__delta--positive')).toBe(true);
    expect(delta?.querySelector('.pi-arrow-up-right')).not.toBeNull();
  });

  it('replaces the value with a status skeleton while loading', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsStatTile);
    const tile = fixture.componentInstance;
    tile.label = 'Ventas netas';
    tile.loading = true;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.rms-stat__value')).toBeNull();
  });
});
