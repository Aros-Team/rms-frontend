/**
 * Tests for the OptionGroupBadgeComponent.
 *
 * Feature: Displays a badge with option group type, label, and color.
 * Contract: Renders the mapped label and tone through the `app-rms-badge`
 * primitive for each selection type, preserving the `size` input.
 * Approach: Mount component via TestBed with a test host, set the input, and
 * assert the rendered `app-rms-badge` label, tone class and size class.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { OptionGroupBadgeComponent } from './option-group-badge';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

import optionGroupBadgeHtml from './option-group-badge.html?raw';
import badgeHtml from '@app/shared/ui/badge/badge.html?raw';

@Component({
  standalone: true,
  imports: [OptionGroupBadgeComponent],
  template: `<app-option-group-badge [selectionType]="type" [size]="size" />`,
})
class TestHostComponent {
  type = OptionSelectionType.SINGLE_CHOICE;
  size: 'sm' | 'md' = 'md';
}

describe('OptionGroupBadgeComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('option-group-badge.html')) {
        return Promise.resolve(optionGroupBadgeHtml as unknown as string);
      }
      if (url.endsWith('badge.html')) {
        return Promise.resolve(badgeHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setupHost(type: OptionSelectionType, size: 'sm' | 'md' = 'md'): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.type = type;
    fixture.componentInstance.size = size;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function getBadge(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('app-rms-badge .rms-badge');
  }

  function expectBadge(label: string, tone: string, size = 'md'): void {
    const badge = getBadge();
    expect(badge?.querySelector('.rms-badge__label')?.textContent.trim()).toBe(label);
    expect(badge?.classList.contains(`rms-badge--${tone}`)).toBe(true);
    expect(badge?.classList.contains(`rms-badge--${size}`)).toBe(true);
  }

  it('should have selector app-option-group-badge', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    const badge = fixture.debugElement.children[0]?.componentInstance as OptionGroupBadgeComponent | undefined;
    expect(badge).toBeInstanceOf(OptionGroupBadgeComponent);
  });

  it('should render an app-rms-badge element', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-rms-badge'),
    ).not.toBeNull();
  });

  it('should render SINGLE_CHOICE with correct config', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    expectBadge('Única opción', 'info');
  });

  it('should render MULTI_SELECT with correct config', async () => {
    await setupHost(OptionSelectionType.MULTI_SELECT);
    expectBadge('Selección múltiple', 'success');
  });

  it('should render EXTRA with correct config', async () => {
    await setupHost(OptionSelectionType.EXTRA);
    expectBadge('Extra', 'warning');
  });

  it('should render REMOVE with correct config', async () => {
    await setupHost(OptionSelectionType.REMOVE);
    expectBadge('Quitar', 'danger');
  });

  it('should pass size sm to the badge', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'sm');
    expect(getBadge()?.classList.contains('rms-badge--sm')).toBe(true);
  });

  it('should pass size md to the badge', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'md');
    expect(getBadge()?.classList.contains('rms-badge--md')).toBe(true);
  });
});
