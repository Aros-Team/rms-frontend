/**
 * Tests for the SearchInput component.
 *
 * Feature: Debounced search input with clear button.
 * Contract: Emits search term after debounce, clears on button click, shows placeholder.
 * Approach: Mount component via TestBed, type input, advance timers, assert emitted values.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Component } from '@angular/core';

import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';
import { SearchInput } from './search-input';

import searchInputHtml from './search-input.html?raw';
import iconButtonHtml from '@shared/ui/icon-button/icon-button.html?raw';

@Component({
  template: `
    <app-search-input
      [debounceMs]="debounceMs"
      (searchChange)="onSearchChange($event)"
    />
  `,
  imports: [SearchInput],
})
class TestHost {
  debounceMs = 500;
  searchValue = '';
  searchChanges: string[] = [];
  searchInput: SearchInput | null = null;

  value(): string {
    return this.searchInput?.value() ?? '';
  }

  onSearchChange(value: string): void {
    this.searchValue = value;
    this.searchChanges.push(value);
  }
}

describe('SearchInput', () => {
  beforeAll(async () => {
    await resolveUiResources({
      'search-input.html': searchInputHtml as unknown as string,
      'icon-button.html': iconButtonHtml as unknown as string,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupHost(overrides: Partial<{
    debounceMs: number;
  }> = {}): Promise<ComponentFixture<TestHost>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    const host = fixture.componentInstance;
    if (overrides.debounceMs !== undefined) host.debounceMs = overrides.debounceMs;
    fixture.detectChanges();
    host.searchInput = fixture.debugElement.children[0]?.injector.get(SearchInput) ?? null;
    return fixture;
  }

  function typeValue(fixture: ComponentFixture<TestHost>, value: string): void {
    const root = fixture.nativeElement as HTMLElement;
    const inputEl = root.querySelector('input');
    if (!inputEl) throw new Error('input not found');
    inputEl.value = value;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  it('emits only after debounceMs of inactivity', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const host = fixture.componentInstance;

    typeValue(fixture, 'foo');

    vi.advanceTimersByTime(299);
    expect(host.searchChanges).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(host.searchChanges).toEqual(['foo']);
  });

  it('does not emit duplicate values', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const host = fixture.componentInstance;

    typeValue(fixture, 'foo');
    vi.advanceTimersByTime(300);
    expect(host.searchChanges).toEqual(['foo']);

    typeValue(fixture, 'foo');
    vi.advanceTimersByTime(300);
    expect(host.searchChanges).toEqual(['foo']);
  });

  it('trims whitespace before emit', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const host = fixture.componentInstance;

    typeValue(fixture, '  hello  ');
    vi.advanceTimersByTime(300);

    expect(host.searchChanges).toEqual(['hello']);
  });

  it('clear button emits empty string', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const host = fixture.componentInstance;

    typeValue(fixture, 'foo');
    vi.advanceTimersByTime(300);
    expect(host.searchChanges).toEqual(['foo']);

    const clearButton = (fixture.nativeElement as HTMLElement).querySelector('app-rms-icon-button button');
    if (!clearButton) throw new Error('clear button not rendered');
    clearButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    vi.advanceTimersByTime(300);

    expect(host.searchChanges).toEqual(['foo', '']);
  });

  it('renders the clear button only when there is a value', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-rms-icon-button button')).toBeNull();

    typeValue(fixture, 'foo');

    expect(root.querySelector('app-rms-icon-button button')?.tagName.toLowerCase()).toBe('button');
  });

  it('destination signal updates on input', async () => {
    const fixture = await setupHost({ debounceMs: 300 });
    const host = fixture.componentInstance;

    typeValue(fixture, 'foo');

    expect(host.value()).toBe('foo');
  });
});
