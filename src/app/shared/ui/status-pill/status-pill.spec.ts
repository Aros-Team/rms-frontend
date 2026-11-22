/**
 * Tests for the RmsStatusPill primitive.
 *
 * Feature: domain status as text plus optional dot.
 * Contract:
 *  - status maps to the semantic pill class
 *  - the label is rendered, so status never depends on colour alone
 *  - the dot can be disabled
 *
 * Approach: TestBed render and attribute assertions.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsStatusPill } from './status-pill';
import { resolveUiResources } from '../testing/ui-test-resources';
import statusPillHtml from './status-pill.html?raw';

describe('RmsStatusPill', () => {
  let fixture: ComponentFixture<RmsStatusPill>;

  beforeAll(async () => {
    await resolveUiResources({ 'status-pill.html': statusPillHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsStatusPill] }).compileComponents();
    fixture = TestBed.createComponent(RmsStatusPill);
    const pill = fixture.componentInstance;
    pill.label = 'Preparando';
    pill.status = 'info';
    fixture.detectChanges();
  });

  it('maps the status to the semantic pill class', () => {
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.rms-pill')?.classList.contains('rms-pill--info'),
    ).toBe(true);
  });

  it('always renders the status label', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.rms-pill__label')?.textContent.trim()).toBe(
      'Preparando',
    );
  });

  it('renders no dot when dot is false', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsStatusPill);
    const pill = fixture.componentInstance;
    pill.label = 'Preparando';
    pill.status = 'info';
    pill.dot = false;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rms-pill__dot')).toBeNull();
  });
});
