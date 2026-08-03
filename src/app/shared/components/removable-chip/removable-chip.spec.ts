import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

import { RemovableChip, type RemovableChipData } from './removable-chip';

import removableChipHtml from './removable-chip.html?raw';

describe('RemovableChip', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('removable-chip.html')) {
        return Promise.resolve(removableChipHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function buildChip(overrides: Partial<RemovableChipData> = {}): RemovableChipData {
    return { id: 1, label: 'Test', ...overrides };
  }

  async function setup(chip: RemovableChipData): Promise<ComponentFixture<RemovableChip>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [RemovableChip],
    }).compileComponents();

    const fixture = TestBed.createComponent(RemovableChip);
    fixture.componentInstance.chip = chip;
    fixture.detectChanges();
    return fixture;
  }

  it('has selector app-removable-chip', async () => {
    const fixture = await setup(buildChip());
    expect(fixture.componentInstance).toBeInstanceOf(RemovableChip);
  });

  it('renders chip.label in the span', async () => {
    const fixture = await setup(buildChip({ label: 'Queso' }));
    const el = fixture.nativeElement as HTMLElement;
    const span = el.querySelector('span.text-sm');
    expect(span?.textContent.trim()).toBe('Queso');
  });

  it('renders chip.meta in the meta span when provided', async () => {
    const fixture = await setup(buildChip({ meta: '+$500' }));
    const el = fixture.nativeElement as HTMLElement;
    const spans = el.querySelectorAll('span');
    const metaSpan = Array.from(spans).find((s) =>
      s.classList.contains('text-xs')
    ) as HTMLElement | undefined;
    expect(metaSpan?.textContent.trim()).toBe('+$500');
  });

  it('does not render meta span when meta is absent', async () => {
    const fixture = await setup(buildChip({ meta: undefined }));
    const el = fixture.nativeElement as HTMLElement;
    const metaSpan = el.querySelector('span.text-xs');
    expect(metaSpan).toBeNull();
  });

  it('renders chip.icon on the i element when provided', async () => {
    const fixture = await setup(buildChip({ icon: 'pi pi-check' }));
    const el = fixture.nativeElement as HTMLElement;
    const icon = el.querySelector('i.pi.pi-check');
    expect(icon).toBeTruthy();
  });

  it('does not render icon i element when icon is absent', async () => {
    const fixture = await setup(buildChip({ icon: undefined }));
    const el = fixture.nativeElement as HTMLElement;
    const icons = el.querySelectorAll('i');
    expect(icons.length).toBe(1); // only the times icon
  });

  it('click on the × button emits removed with chip.id', async () => {
    const fixture = await setup(buildChip({ id: 42 }));
    const spy = vi.fn();
    fixture.componentInstance.removed.subscribe(spy);

    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith(42);
  });

  it('click does NOT emit when chip.disabled is true', async () => {
    const fixture = await setup(buildChip({ id: 7, disabled: true }));
    const spy = vi.fn();
    fixture.componentInstance.removed.subscribe(spy);

    const el = fixture.nativeElement as HTMLElement;
    const btn = el.querySelector('button');
    btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    expect(spy).not.toHaveBeenCalled();
  });
});
