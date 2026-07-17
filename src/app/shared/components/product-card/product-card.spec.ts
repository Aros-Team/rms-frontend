import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';

import { ProductSimpleResponse } from '@app/shared/models/dto/products/product-simple-response';
import { ProductCard } from './product-card';

import productCardHtml from './product-card.html?raw';

const TEST_PRODUCT: ProductSimpleResponse = {
  id: 1,
  name: 'Hamburguesa',
  basePrice: 15000,
  active: true,
  categoryId: 1,
  categoryName: 'Comidas',
  areaId: 1,
};

@Component({
  template: `
    <app-product-card
      [product]="product"
      [selected]="selected"
      [disabled]="disabled"
      [unavailable]="unavailable"
      [loading]="loading"
      (cardToggle)="onToggle($event)"
    />
  `,
  imports: [ProductCard],
})
class TestHost {
  product: ProductSimpleResponse | null = { ...TEST_PRODUCT };
  selected = false;
  disabled = false;
  unavailable = false;
  loading = false;
  toggled: ProductSimpleResponse | null = null;

  onToggle(p: ProductSimpleResponse): void {
    this.toggled = p;
  }
}

function getCardEl(root: HTMLElement): HTMLElement | null {
  return root.querySelector('[role="option"]');
}

describe('ProductCard', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('product-card.html')) {
        return Promise.resolve(productCardHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setupHost(overrides: Partial<{
    loading: boolean;
    selected: boolean;
    disabled: boolean;
    unavailable: boolean;
  }> = {}): Promise<ComponentFixture<TestHost>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    const host = fixture.componentInstance;
    if (overrides.loading !== undefined) host.loading = overrides.loading;
    if (overrides.selected !== undefined) host.selected = overrides.selected;
    if (overrides.disabled !== undefined) host.disabled = overrides.disabled;
    if (overrides.unavailable !== undefined) host.unavailable = overrides.unavailable;
    fixture.detectChanges();
    return fixture;
  }

  it('renders skeleton when loading', async () => {
    const fixture = await setupHost({ loading: true });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('p-skeleton')).toBeTruthy();
    expect(getCardEl(root)).toBeNull();
  });

  it('renders product name and price formatted', async () => {
    const fixture = await setupHost();
    const root = fixture.nativeElement as HTMLElement;
    const card = getCardEl(root);
    expect(card).toBeTruthy();

    expect(card?.textContent).toContain('Hamburguesa');
    expect(card?.textContent).toContain('$15,000');
  });

  it('renders placeholder image when no thumbnailUrl', async () => {
    const fixture = await setupHost();
    const root = fixture.nativeElement as HTMLElement;
    const img = root.querySelector('img');
    expect(img?.getAttribute('src')).toBe('assets/placeholder-product.svg');
  });

  it('selected state shows primary border and check icon', async () => {
    const fixture = await setupHost({ selected: true });
    const root = fixture.nativeElement as HTMLElement;
    const card = getCardEl(root);
    expect(card).toBeTruthy();

    expect(card?.classList.contains('border-primary')).toBe(true);
    expect(root.querySelector('.pi-check-circle')).toBeTruthy();
  });

  it('disabled state blocks click emit', async () => {
    const fixture = await setupHost({ disabled: true });
    const root = fixture.nativeElement as HTMLElement;
    const card = getCardEl(root);
    expect(card).toBeTruthy();

    let emitted = false;
    fixture.componentInstance.onToggle = () => { emitted = true; };

    card?.click();
    expect(emitted).toBe(false);
  });

  it('unavailable state shows badge and crossed price', async () => {
    const fixture = await setupHost({ unavailable: true });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('No disponible');

    const card = getCardEl(root);
    expect(card).toBeTruthy();
    expect(card?.classList.contains('pointer-events-none')).toBe(true);

    const priceSpan = root.querySelector('.line-through');
    expect(priceSpan).toBeTruthy();
  });

  it('keyboard Enter emits toggle', async () => {
    const fixture = await setupHost();
    const root = fixture.nativeElement as HTMLElement;
    const cardEl = root.querySelector('[role="option"]');
    expect(cardEl).toBeTruthy();

    let emitted: ProductSimpleResponse | null = null;
    fixture.debugElement.children[0]?.injector.get(ProductCard).cardToggle.subscribe((p) => { emitted = p; });

    cardEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(emitted).toEqual(TEST_PRODUCT);
  });

  it('keyboard Space emits toggle', async () => {
    const fixture = await setupHost();
    const root = fixture.nativeElement as HTMLElement;
    const cardEl = root.querySelector('[role="option"]');
    expect(cardEl).toBeTruthy();

    let emitted: ProductSimpleResponse | null = null;
    fixture.debugElement.children[0]?.injector.get(ProductCard).cardToggle.subscribe((p) => { emitted = p; });

    cardEl.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(emitted).toEqual(TEST_PRODUCT);
  });

  it('tabindex is 0 when not disabled', async () => {
    const fixture = await setupHost();
    const root = fixture.nativeElement as HTMLElement;
    const card = getCardEl(root);
    expect(card).toBeTruthy();

    expect(card?.getAttribute('tabindex')).toBe('0');
  });

  it('tabindex is -1 when disabled', async () => {
    const fixture = await setupHost({ disabled: true });
    const root = fixture.nativeElement as HTMLElement;
    const card = getCardEl(root);
    expect(card).toBeTruthy();

    expect(card?.getAttribute('tabindex')).toBe('-1');
  });
});
