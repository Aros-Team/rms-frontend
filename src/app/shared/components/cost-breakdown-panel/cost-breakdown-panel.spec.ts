/**
 * Tests for the CostBreakdownPanelComponent.
 *
 * Feature: Displays a cost breakdown table with items, types, and totals.
 * Contract: Renders cost items in a table, calculates and displays total cost.
 * Approach: Mount component via TestBed, set input data, assert rendered table rows and totals.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

import { CostBreakdownPanelComponent } from './cost-breakdown-panel';

import costBreakdownPanelHtml from './cost-breakdown-panel.html?raw';

describe('CostBreakdownPanel', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('cost-breakdown-panel.html')) {
        return Promise.resolve(costBreakdownPanelHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function buildBreakdown(overrides: Partial<{
    productId: number;
    name: string;
    baseCost: { amount: number; currency: string };
    options: {
      optionId: number;
      name: string;
      cost: { amount: number; currency: string };
      extraPrice: { amount: number; currency: string };
      categoryId: number;
      categorySelectionType: string;
    }[];
    categories: {
      categoryId: number;
      name: string;
      selectionType: string;
      defaultSlotCost: { amount: number; currency: string };
      slotProjectedCost: { amount: number; currency: string };
      projectedContribution: { amount: number; currency: string };
    }[];
    projectedOptionCost: { amount: number; currency: string };
    projectedEffectiveCost: { amount: number; currency: string };
  }> = {}) {
    return {
      productId: 1,
      name: 'Hamburguesa',
      baseCost: { amount: 15000, currency: 'COP' },
      options: [
        { optionId: 1, name: 'Queso extra', cost: { amount: 2000, currency: 'COP' }, extraPrice: { amount: 2000, currency: 'COP' }, categoryId: 1, categorySelectionType: 'SINGLE' },
      ],
      categories: [
        { categoryId: 1, name: 'Extras', selectionType: 'SINGLE', defaultSlotCost: { amount: 0, currency: 'COP' }, slotProjectedCost: { amount: 2000, currency: 'COP' }, projectedContribution: { amount: 2000, currency: 'COP' } },
      ],
      projectedOptionCost: { amount: 2000, currency: 'COP' },
      projectedEffectiveCost: { amount: 17000, currency: 'COP' },
      ...overrides,
    };
  }

  async function setup(opts: {
    breakdown?: ReturnType<typeof buildBreakdown> | null;
    compact?: boolean;
  } = {}): Promise<ComponentFixture<CostBreakdownPanelComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CostBreakdownPanelComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(CostBreakdownPanelComponent);
    if (opts.breakdown !== undefined) {
      fixture.componentInstance.breakdown = opts.breakdown;
    } else {
      fixture.componentInstance.breakdown = buildBreakdown();
    }
    if (opts.compact !== undefined) {
      fixture.componentInstance.compact = opts.compact;
    }
    fixture.detectChanges();
    return fixture;
  }

  function getText(fixture: ComponentFixture<CostBreakdownPanelComponent>): string {
    return (fixture.nativeElement as HTMLElement).textContent;
  }

  it('has selector app-cost-breakdown-panel', async () => {
    const fixture = await setup();
    expect(fixture.debugElement.componentInstance).toBeInstanceOf(CostBreakdownPanelComponent);
  });

  it('renders nothing when breakdown is null', async () => {
    const fixture = await setup({ breakdown: null });
    expect(getText(fixture).trim()).toBe('');
  });

  it('renders base cost', async () => {
    const fixture = await setup();
    const text = getText(fixture);
    expect(text).toContain('Costo base');
    expect(text).toContain('$15.000');
  });

  it('renders options with name and cost', async () => {
    const fixture = await setup();
    const text = getText(fixture);
    expect(text).toContain('Opciones');
    expect(text).toContain('Queso extra');
    expect(text).toContain('$2.000');
  });

  it('renders categories with name and slotProjectedCost', async () => {
    const fixture = await setup();
    const text = getText(fixture);
    expect(text).toContain('Categorías');
    expect(text).toContain('Extras');
    expect(text).toContain('$2.000');
  });

  it('renders effective cost', async () => {
    const fixture = await setup();
    const text = getText(fixture);
    expect(text).toContain('Costo efectivo');
    expect(text).toContain('$17.000');
  });

  it('hides detailed options list when compact=true', async () => {
    const fixture = await setup({ compact: true });
    const text = getText(fixture);
    expect(text).toContain('Opciones');
    expect(text).toContain('$2.000');
    expect(text).not.toContain('Queso extra');
  });

  it('hides categories section when compact=true', async () => {
    const fixture = await setup({ compact: true });
    const text = getText(fixture);
    expect(text).not.toContain('Categorías');
    expect(text).not.toContain('Extras');
  });

  it('formatMoney returns $0 for zero amount', async () => {
    const fixture = await setup({ breakdown: buildBreakdown({ baseCost: { amount: 0, currency: 'COP' } }) });
    const text = getText(fixture);
    expect(text).toContain('$0');
  });

  it('formatMoney returns formatted string for valid amount', async () => {
    const fixture = await setup();
    const text = getText(fixture);
    expect(text).toContain('$15.000');
  });

  it('hides options section when options array is empty', async () => {
    const fixture = await setup({ breakdown: buildBreakdown({ options: [], projectedOptionCost: { amount: 0, currency: 'COP' } }) });
    const text = getText(fixture);
    expect(text).not.toContain('Opciones');
  });

  it('hides categories section when categories array is empty', async () => {
    const fixture = await setup({ breakdown: buildBreakdown({ categories: [] }) });
    const text = getText(fixture);
    expect(text).not.toContain('Categorías');
  });
});
