/**
 * Tests for the RmsSection primitive.
 *
 * Feature: page section with an owned heading level.
 * Contract:
 *  - level 2 renders an H2, level 3 renders an H3
 *  - the section is labelled by its own heading id
 *  - the description is optional prose
 *
 * Approach: TestBed render, assert the heading tag and the aria-labelledby.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsSection } from './section';
import { resolveUiResources } from '../testing/ui-test-resources';
import sectionHtml from './section.html?raw';

describe('RmsSection', () => {
  let fixture: ComponentFixture<RmsSection>;

  beforeAll(async () => {
    await resolveUiResources({ 'section.html': sectionHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsSection] }).compileComponents();
    fixture = TestBed.createComponent(RmsSection);
    fixture.componentInstance.title = 'Ventas del día';
    fixture.componentInstance.description = 'Pedidos entregados y cobrados.';
    fixture.detectChanges();
  });

  it('renders an H2 by default and labels the section with it', () => {
    const section = (fixture.nativeElement as HTMLElement).querySelector('section');
    const heading = (fixture.nativeElement as HTMLElement).querySelector('h2');

    expect(heading?.textContent.trim()).toBe('Ventas del día');
    expect(section?.getAttribute('aria-labelledby')).toBe(fixture.componentInstance.headingId);
    expect(heading?.id).toBe(fixture.componentInstance.headingId);
  });

  it('renders an H3 when nested', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsSection);
    fixture.componentInstance.title = 'Detalle por categoría';
    fixture.componentInstance.level = 3;
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('h3')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('h2')).toBeNull();
  });

  it('renders the description as supporting prose', () => {
    const description = (fixture.nativeElement as HTMLElement).querySelector('.rms-section__description');

    expect(description?.textContent.trim()).toBe('Pedidos entregados y cobrados.');
  });
});
