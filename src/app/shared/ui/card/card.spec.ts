/**
 * Tests for the RmsCard primitive.
 *
 * Feature: bordered surface with an optional header.
 * Contract:
 *  - the surface tone and padding map to classes
 *  - the header renders an H3 only when a title exists
 *  - the subtitle is a caption paragraph
 *
 * Approach: TestBed render with plain inputs set before the first check.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsCard } from './card';
import { resolveUiResources } from '../testing/ui-test-resources';
import cardHtml from './card.html?raw';

describe('RmsCard', () => {
  let fixture: ComponentFixture<RmsCard>;

  beforeAll(async () => {
    await resolveUiResources({ 'card.html': cardHtml as unknown as string });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [RmsCard] }).compileComponents();
    fixture = TestBed.createComponent(RmsCard);
    fixture.componentInstance.title = 'Resumen del día';
    fixture.componentInstance.subtitle = 'Actualizado hace 2 minutos';
    fixture.componentInstance.tone = 'subtle';
    fixture.componentInstance.padding = 'lg';
    fixture.detectChanges();
  });

  it('maps tone and padding to classes', () => {
    const card = (fixture.nativeElement as HTMLElement).querySelector('.rms-card');

    expect(card?.classList.contains('rms-card--subtle')).toBe(true);
    expect(card?.classList.contains('rms-card--pad-lg')).toBe(true);
  });

  it('renders the header title as an H3 and the subtitle as caption prose', () => {
    const title = (fixture.nativeElement as HTMLElement).querySelector('h3.rms-card__title');
    const subtitle = (fixture.nativeElement as HTMLElement).querySelector('.rms-card__subtitle');

    expect(title?.textContent.trim()).toBe('Resumen del día');
    expect(subtitle?.textContent.trim()).toBe('Actualizado hace 2 minutos');
  });

  it('omits the header when there is no title or subtitle', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(RmsCard);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.rms-card__header')).toBeNull();
  });
});
