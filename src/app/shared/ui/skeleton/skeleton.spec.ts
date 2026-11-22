/**
 * Tests for the RmsSkeleton primitive.
 *
 * Feature: loading placeholder announced as a status.
 * Contract:
 *  - the wrapper has role="status" and an accessible label
 *  - text variant renders one bar per line and the last line is shorter
 *  - bars are aria-hidden so they are not announced as empty content
 *
 * Approach: TestBed render and DOM assertions.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsSkeleton } from './skeleton';
import { resolveUiResources } from '../testing/ui-test-resources';
import skeletonHtml from './skeleton.html?raw';

describe('RmsSkeleton', () => {
  let fixture: ComponentFixture<RmsSkeleton>;

  beforeAll(async () => {
    await resolveUiResources({ 'skeleton.html': skeletonHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsSkeleton] }).compileComponents();
    fixture = TestBed.createComponent(RmsSkeleton);
    const skeleton = fixture.componentInstance;
    skeleton.variant = 'text';
    skeleton.lines = 3;
    skeleton.ariaLabel = 'Cargando pedidos';
    fixture.detectChanges();
  });

  it('announces loading as a status with a label', () => {
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');

    expect(status?.getAttribute('aria-label')).toBe('Cargando pedidos');
  });

  it('renders one bar per line and hides them from assistive technology', () => {
    const bars = (fixture.nativeElement as HTMLElement).querySelectorAll('.rms-skeleton__bar');

    expect(bars).toHaveLength(3);
    expect(bars[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('shortens the last line of a multi-line block', () => {
    const bars = (fixture.nativeElement as HTMLElement).querySelectorAll('.rms-skeleton__bar');

    expect((bars[2] as HTMLElement).style.width).toBe('62%');
  });
});
