/**
 * Tests for the RmsSheet primitive.
 *
 * Feature: simple overlay on the native <dialog> element.
 * Contract:
 *  - the sheet names itself with the title id
 *  - open calls showModal (or the `open` attribute fallback in jsdom)
 *  - the close button emits openChange(false)
 *  - a non-dismissible sheet hides the close control
 *
 * Approach: TestBed render, read the native dialog attributes and emitted
 * events; no animation provider is required because the element is native.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsSheet } from './sheet';
import { queryElement, resolveUiResources } from '../testing/ui-test-resources';
import sheetHtml from './sheet.html?raw';
import iconButtonHtml from '../icon-button/icon-button.html?raw';

describe('RmsSheet', () => {
  let fixture: ComponentFixture<RmsSheet>;
  let sheet: RmsSheet;

  beforeAll(async () => {
    await resolveUiResources({
      'sheet.html': sheetHtml as unknown as string,
      'icon-button.html': iconButtonHtml as unknown as string,
    });
  });

  function create(open: boolean, dismissible = true): void {
    fixture = TestBed.createComponent(RmsSheet);
    sheet = fixture.componentInstance;
    sheet.title = 'Filtros';
    sheet.dismissible = dismissible;
    sheet.open = open;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsSheet] }).compileComponents();
    create(true);
  });

  it('names the dialog with its title', () => {
    const dialog = (fixture.nativeElement as HTMLElement).querySelector('dialog');
    const title = dialog?.querySelector('h2');

    expect(dialog?.getAttribute('aria-labelledby')).toBe(sheet.titleId);
    expect(title?.id).toBe(sheet.titleId);
    expect(title?.textContent.trim()).toBe('Filtros');
  });

  it('opens the native dialog when the input is true', () => {
    const dialog = queryElement(fixture.nativeElement as HTMLElement, 'dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
  });

  it('emits openChange(false) from the close control', () => {
    const spy = vi.fn();
    sheet.openChange.subscribe(spy);
    queryElement(fixture.nativeElement as HTMLElement, 'button[aria-label="Cerrar"]').click();

    expect(spy).toHaveBeenCalledWith(false);
  });

  it('hides the close control when the sheet is not dismissible', () => {
    fixture.destroy();
    create(true, false);
    const close = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Cerrar"]',
    );

    expect(close).toBeNull();
  });
});
