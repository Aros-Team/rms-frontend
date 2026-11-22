/**
 * Tests for the two read-only settings sections.
 *
 * Feature: `/admin/settings` → Integraciones and Datos de demostración.
 * Contract: integrations render the deployment origins without inputs or
 * secrets; the demo card lists the CLI commands, is dev-only and has no
 * destructive button.
 *
 * Approach: mount each component with the resolved templates. Both templates are
 * resolved in a single pass because `resolveComponentResources` must only be
 * called once per test file.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeAll, describe, expect, it } from 'vitest';

import { environment } from '@environments/environment';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { DemoDataSettingsSection } from './demo-data/demo-data-settings';
import { IntegrationsSettingsSection } from './integrations/integrations-settings';
import demoHtml from './demo-data/demo-data-settings.html?raw';
import integrationsHtml from './integrations/integrations-settings.html?raw';
import sectionHtml from '@shared/ui/section/section.html?raw';

beforeAll(async () => {
  await resolveUiResources({
    'demo-data-settings.html': demoHtml as unknown as string,
    'integrations-settings.html': integrationsHtml as unknown as string,
    'section.html': sectionHtml as unknown as string,
  });
});

describe('IntegrationsSettingsSection', () => {
  let fixture: ComponentFixture<IntegrationsSettingsSection>;

  it('renders the deployment origins as read-only data', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [IntegrationsSettingsSection] });
    fixture = TestBed.createComponent(IntegrationsSettingsSection);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(component.rows.map((row) => row.value)).toContain(environment.apiUrl);
    expect(component.rows.map((row) => row.value)).toContain(environment.agentHost);
    expect(text).toContain(environment.apiUrl);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input, textarea').length).toBe(0);
  });
});

describe('DemoDataSettingsSection', () => {
  let fixture: ComponentFixture<DemoDataSettingsSection>;

  it('lists the seed commands without a destructive action', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [DemoDataSettingsSection] });
    fixture = TestBed.createComponent(DemoDataSettingsSection);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const text = (fixture.nativeElement as HTMLElement).textContent;

    expect(component.isDev).toBe(true);
    expect(component.commands.map((item) => item.command)).toEqual([
      './gradlew seedReset -Panchor=2026-11-21 -Pdays=180 -Pdataset=dev',
      './gradlew seedVerify -Panchor=2026-11-21',
      'GET /api/v1/dev/seed/status',
    ]);
    expect(text).toContain('No hay un botón destructivo');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button').length).toBe(0);
  });
});
