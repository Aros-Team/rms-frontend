/**
 * Tests for the RmsChartFrame primitive.
 *
 * Feature: the only chart container (title, states, HTML legend, data table).
 * Contract:
 *  - the title is the figure caption and a real heading
 *  - loading/empty/error render a status/alert state without collapsing
 *  - the error state offers a retry that emits
 *  - a summary names the plot as an image for screen readers
 *  - the data fallback is rendered only when dataMode is on
 *
 * Approach: mount a host template with projected content and outputs, then
 * assert the state region and its role.
 */
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RmsChartFrame } from './chart-frame';
import { queryElement, resolveUiResources } from '../testing/ui-test-resources';
import chartFrameHtml from './chart-frame.html?raw';
import buttonHtml from '../button/button.html?raw';
import skeletonHtml from '../skeleton/skeleton.html?raw';

@Component({
  standalone: true,
  imports: [RmsChartFrame],
  template: `
    <app-rms-chart-frame
      title="Ventas netas"
      subtitle="Últimos 6 meses"
      summary="Ventas netas por mes, de mayo a octubre"
      [empty]="empty"
      [loading]="loading"
      [error]="error"
      dataMode="disclosure"
      (retry)="retries = retries + 1"
    >
      <div class="fake-chart">chart</div>
      <table rmsChartData>
        <tbody>
          <tr>
            <td>Mayo</td>
          </tr>
        </tbody>
      </table>
    </app-rms-chart-frame>
  `,
})
class ChartFrameHost {
  empty = false;
  loading = false;
  error = '';
  retries = 0;
}

describe('RmsChartFrame', () => {
  let fixture: ComponentFixture<ChartFrameHost>;
  let host: ChartFrameHost;

  beforeAll(async () => {
    await resolveUiResources({
      'chart-frame.html': chartFrameHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'skeleton.html': skeletonHtml as unknown as string,
    });
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [ChartFrameHost] }).compileComponents();
    fixture = TestBed.createComponent(ChartFrameHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the title as the figure caption heading', () => {
    const title = (fixture.nativeElement as HTMLElement).querySelector('.rms-chart-frame__title');

    expect(title?.tagName).toBe('H3');
    expect(title?.textContent.trim()).toBe('Ventas netas');
  });

  it('names the plot as an image with the summary', () => {
    const plot = (fixture.nativeElement as HTMLElement).querySelector('.rms-chart-frame__plot');

    expect(plot?.getAttribute('role')).toBe('img');
    expect(plot?.getAttribute('aria-label')).toBe(
      'Ventas netas por mes, de mayo a octubre',
    );
  });

  it('renders the empty state as a status and keeps the data table available', () => {
    host.empty = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const state = (fixture.nativeElement as HTMLElement).querySelector('.rms-chart-frame__state');

    expect(state?.getAttribute('role')).toBe('status');
    expect(state?.textContent).toContain('Sin datos para este periodo');
    expect((fixture.nativeElement as HTMLElement).querySelector('details table')).not.toBeNull();
  });

  it('renders an error as an alert and emits retry', () => {
    host.error = 'No se pudo cargar la información';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const state = (fixture.nativeElement as HTMLElement).querySelector('.rms-chart-frame__state');

    expect(state?.getAttribute('role')).toBe('alert');
    queryElement(state, 'button').click();
    expect(host.retries).toBe(1);
  });

  it('announces loading with the skeleton status', () => {
    host.loading = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')).not.toBeNull();
  });
});
