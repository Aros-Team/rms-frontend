/**
 * Tests for the OptionGroupBadgeComponent.
 *
 * Feature: Displays a badge with option group type, label, and color.
 * Contract: Renders correct label, icon, and severity badge for each selection type.
 * Approach: Mount component via TestBed with a test host, set the input, and assert
 * the exact `value`/`icon`/`severity` passed to the `p-tag` child plus the inline
 * compact-style values (p-tag has no style input; `[style]` lands on the host).
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Tag } from 'primeng/tag';
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

  function getTagComponent(): Tag {
    return fixture.debugElement.query(By.css('p-tag')).componentInstance as Tag;
  }

  it('should have selector app-option-group-badge', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    const badge = fixture.debugElement.children[0]?.componentInstance as OptionGroupBadgeComponent | undefined;
    expect(badge).toBeInstanceOf(OptionGroupBadgeComponent);
  });

  it('should render a p-tag element', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    expect(getTag()?.tagName.toLowerCase()).toBe('p-tag');
  });

  it('should render SINGLE_CHOICE with correct config', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE);
    const tag = getTagComponent();
    expect(tag.value).toBe('Única opción');
    expect(tag.icon).toBe('pi pi-circle');
    expect(tag.severity).toBe('info');
  });

  it('should render MULTI_SELECT with correct config', async () => {
    await setupHost(OptionSelectionType.MULTI_SELECT);
    const tag = getTagComponent();
    expect(tag.value).toBe('Selección múltiple');
    expect(tag.icon).toBe('pi pi-check-square');
    expect(tag.severity).toBe('success');
  });

  it('should render EXTRA with correct config', async () => {
    await setupHost(OptionSelectionType.EXTRA);
    const tag = getTagComponent();
    expect(tag.value).toBe('Extra');
    expect(tag.icon).toBe('pi pi-plus-circle');
    expect(tag.severity).toBe('warn');
  });

  it('should render REMOVE with correct config', async () => {
    await setupHost(OptionSelectionType.REMOVE);
    const tag = getTagComponent();
    expect(tag.value).toBe('Quitar');
    expect(tag.icon).toBe('pi pi-minus-circle');
    expect(tag.severity).toBe('danger');
  });

  it('should apply compact style when size is sm', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'sm');
    const tag = getTag();
    expect(tag?.style.fontSize).toBe('0.7rem');
    expect(tag?.style.padding).toBe('0.1rem 0.4rem');
  });

  it('should not apply compact style when size is md', async () => {
    await setupHost(OptionSelectionType.SINGLE_CHOICE, 'md');
    const tag = getTag();
    expect(tag?.style.fontSize).toBe('');
    expect(tag?.style.padding).toBe('');
  });
});
