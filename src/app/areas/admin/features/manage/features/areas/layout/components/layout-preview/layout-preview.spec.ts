import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AreaResponse } from '@app/shared/models/dto/areas/area';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

import { LayoutPreview } from './layout-preview';
import previewHtml from './layout-preview.html?raw';

const AREAS: AreaResponse[] = [
  { id: 1, name: 'Cocina', activities: ['PREPARATION'], enabled: true, exclusive: false },
];

describe('LayoutPreview', () => {
  let fixture: ComponentFixture<LayoutPreview>;
  let component: LayoutPreview;

  beforeAll(async () => {
    await resolveUiResources({ 'layout-preview.html': previewHtml as unknown as string });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [LayoutPreview] });
    fixture = TestBed.createComponent(LayoutPreview);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('areas', AREAS);
  });

  it('should show the empty message when there are no regions', () => {
    fixture.componentRef.setInput('layout', {
      columns: 20,
      rows: 12,
      regions: [],
      updatedAt: null,
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Aún no hay una distribución del restaurante.');
    expect(host.querySelector('svg')).toBeNull();
  });

  it('should render the saved regions read-only with the area color', () => {
    component.layout = {
      columns: 20,
      rows: 12,
      regions: [
        {
          key: 'a',
          areaId: 1,
          segments: [
            { row: 2, from: 2, to: 5 },
            { row: 3, from: 2, to: 3 },
          ],
        },
      ],
      updatedAt: '2026-11-27T03:00:00Z',
    };
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');
    const region = host.querySelector('g.layout-preview__region');
    expect(svg?.getAttribute('aria-label')).toContain('Distribución del restaurante');
    expect(region).not.toBeNull();
    expect(region?.querySelector('.layout-preview__outline')).not.toBeNull();
    expect(host.textContent).not.toContain('Aún no hay una distribución');
  });
});
