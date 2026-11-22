/**
 * Tests for the RmsDialog primitive.
 *
 * Feature: modal dialog wrapper with a required accessible name and a
 * viewport-clamped width.
 * Contract:
 *  - the header is rendered as the dialog title (the accessible name)
 *  - width is clamped to 92vw and max-height to 92dvh
 *  - the footer slot is part of the dialog content
 *
 * Approach: mount PrimeNG Dialog through the wrapper and assert the rendered
 * title plus the computed style object.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsDialog } from './dialog';
import { resolveUiResources } from '../testing/ui-test-resources';
import dialogHtml from './dialog.html?raw';

describe('RmsDialog', () => {
  let fixture: ComponentFixture<RmsDialog>;
  let dialog: RmsDialog;

  beforeAll(async () => {
    await resolveUiResources({ 'dialog.html': dialogHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsDialog] }).compileComponents();
    fixture = TestBed.createComponent(RmsDialog);
    dialog = fixture.componentInstance;
    dialog.header = 'Nuevo producto';
    dialog.visible = true;
    fixture.detectChanges();
  });

  it('renders the required header as the dialog title', () => {
    const title = document.body.querySelector('.rms-dialog .p-dialog-title');

    expect(title?.textContent.trim()).toBe('Nuevo producto');
  });

  it('clamps the preferred width to the viewport', () => {
    expect(dialog.dialogStyle.width).toBe('min(560px, 92vw)');
    expect(dialog.dialogStyle.maxHeight).toBe('92dvh');
  });

  it('emits visibleChange when the dialog requests a close', () => {
    const spy = vi.fn();
    dialog.visibleChange.subscribe(spy);

    const pDialog = fixture.debugElement.children[0].componentInstance as {
      visibleChange: { emit: (value: boolean) => void };
    };
    pDialog.visibleChange.emit(false);

    expect(spy).toHaveBeenCalledWith(false);
  });
});
