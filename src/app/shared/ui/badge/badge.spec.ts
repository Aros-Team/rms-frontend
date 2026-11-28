/**
 * Tests for the RmsBadge primitive.
 *
 * Feature: non-interactive status/category label.
 * Contract:
 *  - tone, variant and size map to classes
 *  - the label is always rendered as text (colour is not the only encoding)
 *  - the dot is decorative
 *
 * Approach: TestBed render and class/text assertions.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsBadge } from './badge';
import { resolveUiResources } from '../testing/ui-test-resources';
import badgeHtml from './badge.html?raw';

describe('RmsBadge', () => {
  let fixture: ComponentFixture<RmsBadge>;

  beforeAll(async () => {
    await resolveUiResources({ 'badge.html': badgeHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsBadge] }).compileComponents();
    fixture = TestBed.createComponent(RmsBadge);
    const badge = fixture.componentInstance;
    badge.label = 'Activo';
    badge.tone = 'success';
    badge.variant = 'solid';
    badge.dot = true;
    fixture.detectChanges();
  });

  it('maps the tone and variant to classes', () => {
    const badge = (fixture.nativeElement as HTMLElement).querySelector('.rms-badge');

    expect(badge?.classList.contains('rms-badge--success')).toBe(true);
    expect(badge?.classList.contains('rms-badge--solid')).toBe(true);
  });

  it('renders the label as text', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-badge__label')?.textContent.trim(),
    ).toBe('Activo');
  });

  it('hides the dot from assistive technology', () => {
    expect(
      (fixture.nativeElement as HTMLElement)
        .querySelector('.rms-badge__dot')
        ?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
