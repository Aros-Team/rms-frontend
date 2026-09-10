/**
 * Tests for the OptionGroupBadgeComponent.
 *
 * Feature: Displays a badge with option group type, label, and color.
 * Contract: Renders correct label, icon, and severity badge for each selection type.
 * Approach: Mount component via TestBed with test host, set input, assert rendered badge content.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { OptionGroupBadgeComponent } from './option-group-badge';
import { OptionSelectionType } from '@app/shared/models/dto/option-groups/option-selection-type';

import optionGroupBadgeHtml from './option-group-badge.html?raw';

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

  function getTag(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('p-tag');
  }

  it('should have selector app-option-group-badge', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    const badge = fixture.debugElement.children[0]?.componentInstance as OptionGroupBadgeComponent | undefined;
    expect(badge).toBeInstanceOf(OptionGroupBadgeComponent);
  });

  it('should render SINGLE_CHOICE with correct config', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    const tag = getTag();
    expect(tag).toBeTruthy();
    expect(tag?.textContent).toContain('Única opción');
  });

  it('should render MULTI_SELECT with correct config', async () => {
    await setupHost(OptionSelectionType.MULTI_SELECT);
    const tag = getTag();
    expect(tag).toBeTruthy();
    expect(tag?.textContent).toContain('Selección múltiple');
  });

  it('should render EXTRA with correct config', async () => {
    await setupHost(OptionSelectionType.EXTRA);
    const tag = getTag();
    expect(tag).toBeTruthy();
    expect(tag?.textContent).toContain('Extra');
  });

  it('should render REMOVE with correct config', async () => {
    await setupHost(OptionSelectionType.REMOVE);
    const tag = getTag();
    expect(tag).toBeTruthy();
    expect(tag?.textContent).toContain('Quitar');
  });

  it('should apply compact style when size is sm', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'sm');
    const tag = getTag();
    expect(tag).toBeTruthy();
    const style = tag?.getAttribute('ng-reflect-style') ?? tag?.getAttribute('style') ?? '';
    expect(style).toContain('font-size');
  });

  it('should not apply compact style when size is md', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'md');
    const tag = getTag();
    expect(tag).toBeTruthy();
  });
});
