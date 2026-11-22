/**
 * Tests for the settings workspace shell.
 *
 * Feature: `/admin/settings` with one tab per section.
 * Contract:
 *  - ten sections exist in development, including Cuenta and the dev-only demo card;
 *  - only the active section is mounted, so switching issues that section's
 *    request and nothing else;
 *  - the tablist supports arrow/Home/End navigation and exposes ARIA state;
 *  - leaving a dirty section asks first; the same promise backs the route guard;
 *  - a clean workspace navigates without a dialog.
 *
 * Approach: mount the real page with a stubbed API and empty child templates;
 * the page's own template (tablist, header, dialog) is resolved for real.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageService } from 'primeng/api';

import { SettingsApi } from '@services/settings/settings-api';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { SettingsPage } from './settings-page';
import pageHtml from './settings-page.html?raw';
import badgeHtml from '@shared/ui/badge/badge.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import dialogHtml from '@shared/ui/dialog/dialog.html?raw';
import pageHeaderHtml from '@shared/ui/page-header/page-header.html?raw';

const BUSINESS = {
  restaurantName: 'RMS',
  legalName: '',
  taxId: '',
  address: '',
  phone: '',
  email: '',
  timezone: 'America/Bogota',
  locale: 'es-CO',
};

const CURRENCY = {
  code: 'COP',
  displayName: 'Peso colombiano',
  symbol: '$',
  defaultFractionDigits: 2,
};

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;
  let component: SettingsPage;
  let api: {
    getBusiness: ReturnType<typeof vi.fn>;
    getCurrency: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    await resolveUiResources({
      'settings-page.html': pageHtml as unknown as string,
      'badge.html': badgeHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'dialog.html': dialogHtml as unknown as string,
      'page-header.html': pageHeaderHtml as unknown as string,
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    api = {
      getBusiness: vi.fn(() => of({ ...BUSINESS })),
      getCurrency: vi.fn(() => of({ ...CURRENCY })),
    };

    TestBed.configureTestingModule({
      imports: [SettingsPage],
      providers: [
        { provide: SettingsApi, useValue: api },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(SettingsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function tabs(): HTMLButtonElement[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
  }

  function tab(id: string): HTMLButtonElement {
    const element = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      `#settings-tab-${id}`,
    );
    if (element === null) throw new Error(`Missing tab ${id}`);
    return element;
  }

  it('exposes every section, including the dev-only demo card', () => {
    expect(component.sections.map((section) => section.id)).toEqual([
      'business',
      'currency',
      'labor',
      'notifications',
      'users',
      'appearance',
      'account',
      'advanced',
      'integrations',
      'demo',
    ]);
    expect(tabs().length).toBe(10);
    expect(tab('business').getAttribute('aria-selected')).toBe('true');
    expect(tab('currency').getAttribute('aria-selected')).toBe('false');
  });

  it('mounts only the active section', () => {
    expect(api.getBusiness).toHaveBeenCalledTimes(1);
    expect(api.getCurrency).not.toHaveBeenCalled();
  });

  it('switches section on click and loads the new one', () => {
    tab('currency').click();
    fixture.detectChanges();

    expect(component.activeSection()).toBe('currency');
    expect(api.getCurrency).toHaveBeenCalledTimes(1);
    expect(tab('currency').getAttribute('aria-selected')).toBe('true');
  });

  it('moves the selection with the arrow keys', () => {
    tab('business').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    );
    fixture.detectChanges();

    expect(component.activeSection()).toBe('currency');
  });

  it('jumps to the last section with End', () => {
    tab('business').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();

    expect(component.activeSection()).toBe('demo');
  });

  it('resolves the route guard immediately when nothing is dirty', async () => {
    await expect(component.confirmDiscard()).resolves.toBe(true);
    expect(component.confirmVisible()).toBe(false);
  });

  it('asks before switching away from a dirty section', async () => {
    component.markDirty('business', true);

    component.requestSection('labor');
    expect(component.confirmVisible()).toBe(true);
    expect(component.activeSection()).toBe('business');

    component.acceptDiscard();
    await Promise.resolve();

    expect(component.activeSection()).toBe('labor');
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('keeps the current section when the admin cancels', async () => {
    component.markDirty('business', true);

    component.requestSection('labor');
    component.cancelDiscard();
    await Promise.resolve();

    expect(component.activeSection()).toBe('business');
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('resolves the guard false when the admin keeps editing', async () => {
    component.markDirty('business', true);

    const decision = component.confirmDiscard();
    component.cancelDiscard();

    await expect(decision).resolves.toBe(false);
  });

  it('blocks the browser unload prompt when there are unsaved changes', () => {
    const event = new Event('beforeunload', { cancelable: true });
    const prevent = vi.spyOn(event, 'preventDefault');

    component.onBeforeUnload(event as unknown as BeforeUnloadEvent);
    expect(prevent).not.toHaveBeenCalled();

    component.markDirty('business', true);
    component.onBeforeUnload(event as unknown as BeforeUnloadEvent);
    expect(prevent).toHaveBeenCalledTimes(1);
  });

  it('reports dirty state to the shell through the output', () => {
    const emitted: boolean[] = [];
    component.dirtyChange.subscribe((value) => emitted.push(value));

    component.markDirty('business', true);
    component.markDirty('business', false);

    expect(emitted).toEqual([true, false]);
  });
});
