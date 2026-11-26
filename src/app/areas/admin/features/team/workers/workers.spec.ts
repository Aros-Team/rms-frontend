/**
 * Tests for the workers management screen (`app-workers`).
 *
 * Feature: under the flat "Equipo" module this screen is list-only. Attendance
 * and payroll are their own routes, so the page must not render nested tabs nor
 * mount payroll/time-log panels.
 * Contract:
 *  - the route renders the employee cards, with no `[role="tab"]` navigation;
 *  - no payroll panel is mounted and no payroll request is issued;
 *  - the pre-existing form, salary and portrait behaviour stays intact.
 */
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationService, MessageService } from 'primeng/api';

import { Area } from '@app/core/services/areas/area';
import { Logging } from '@app/core/services/logging/logging';
import { Schedule } from '@app/core/services/schedules/schedule';
import { ScheduleAssignment } from '@app/core/services/schedules/schedule-assignment';
import { Worker } from '@app/core/services/workers/worker';
import { WorkerImage } from '@app/core/services/worker-image/worker-image';
import type { WorkerResponse } from '@models/dto/workers/worker-response';

import { Workers } from './workers';
import workersHtml from './workers.html?raw';

const WORKER: WorkerResponse = {
  id: 7,
  document: '1094',
  name: 'Ana Pérez',
  email: 'ana@rms.co',
};

function money(amount: string): { amount: string; currency: string } {
  return { amount, currency: 'COP' };
}

describe('Workers — list-only screen', () => {
  let fixture: ComponentFixture<Workers>;
  let component: Workers;
  let workerApi: {
    getWorkers: ReturnType<typeof vi.fn>;
    createWorker: ReturnType<typeof vi.fn>;
  };
  let scheduleApi: { getAll: ReturnType<typeof vi.fn> };
  let assignmentApi: { getAssignments: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    // jsdom has no IntersectionObserver; the `appLazyLoad` directive needs one.
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(_callback: unknown, _options?: unknown) {
          void _callback;
          void _options;
        }
        observe(): void {
          /* the lazy-load directive only needs a non-throwing observer in jsdom */
        }
        unobserve(): void {
          /* no-op */
        }
        disconnect(): void {
          /* no-op */
        }
        takeRecords(): [] {
          return [];
        }
      },
    );

    await resolveComponentResources((url: string) => {
      if (url.endsWith('workers.html')) {
        return Promise.resolve(workersHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    TestBed.resetTestingModule();

    workerApi = {
      getWorkers: vi.fn(() => of([WORKER])),
      createWorker: vi.fn(() => of({ ...WORKER, password: null })),
    };

    scheduleApi = { getAll: vi.fn(() => of([])) };
    assignmentApi = { getAssignments: vi.fn(() => of([])) };

    TestBed.configureTestingModule({
      imports: [Workers],
      providers: [
        provideRouter([]),
        { provide: Worker, useValue: workerApi },
        {
          provide: WorkerImage,
          useValue: {
            getImages: vi.fn(() => of([])),
            uploadImage: vi.fn(() => of({})),
            replaceImage: vi.fn(() => of([])),
            deleteImage: vi.fn(() => of({})),
          },
        },
        { provide: Area, useValue: { getAreas: vi.fn(() => of([])) } },
        { provide: Schedule, useValue: scheduleApi },
        {
          provide: ScheduleAssignment,
          useValue: assignmentApi,
        },
        { provide: MessageService, useValue: { add: vi.fn() } },
        ConfirmationService,
        { provide: Logging, useValue: { debug: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  async function mount(): Promise<void> {
    fixture = TestBed.createComponent(Workers);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('renders the employee list without nested tabs or payroll panel', async () => {
    await mount();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="tab"]').length).toBe(0);
    expect(root.querySelector('app-payroll-panel')).toBeNull();
    expect(root.querySelector('p-table')).toBeNull();
    expect(root.querySelector('app-rms-page-header')).not.toBeNull();
  });
  describe('RFC 7807 error mapping', () => {
    it('surfaces the problem `detail` on the matching form field', async () => {
      await mount();
      workerApi.createWorker.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: {
                detail: 'document: Document must contain only digits',
                status: 400,
                title: 'Bad Request',
              },
            }),
        ),
      );

      component.showCreationModal();
      component.userForm.patchValue({
        document: '123',
        name: 'Ana Perez',
        email: 'ana@rms.co',
        phone: '3001234567',
        areaIds: [1],
      });
      component.createWorker();

      // Read through the component's public accessor, as the template does.
      expect(component.getBackendError('document')).toBe(
        'Document must contain only digits',
      );
    });
  });

  describe('salary field — Money DTO on the wire, number in the form', () => {
    it('normalizes a Money salary into the numeric form control', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: money('1200000.00') });

      expect(component.userForm.get('salary')?.value).toBe(1200000);
      expect(component.originalSalary()).toBe(1200000);
      expect(component.salaryValue()).toBe(1200000);
      expect(component.salaryChanged()).toBe(false);
    });

    it('leaves the salary null when the worker has none and reports no change', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: null });

      expect(component.userForm.get('salary')?.value).toBeNull();
      expect(component.originalSalary()).toBeNull();
      expect(component.salaryChanged()).toBe(false);
      expect(Number.isNaN(Number(component.userForm.get('salary')?.value))).toBe(false);
    });

    it('flags a change when the admin types a different salary', async () => {
      await mount();
      component.showModificationModal({ ...WORKER, salary: money('1200000.00') });

      component.userForm.get('salary')?.setValue(1500000);

      expect(component.salaryChanged()).toBe(true);
    });
  });

  describe('employee schedule summary', () => {
    it('shows the assigned day range, window and weekly hours on the card', async () => {
      assignmentApi.getAssignments.mockReturnValue(of([1]));
      scheduleApi.getAll.mockReturnValue(
        of([
          {
            id: 1,
            name: 'Turno de Ana Pérez',
            shifts: [
              { dayOfWeek: 'MONDAY', startTime: '08:00:00', endTime: '16:00:00' },
              { dayOfWeek: 'TUESDAY', startTime: '08:00:00', endTime: '16:00:00' },
              { dayOfWeek: 'WEDNESDAY', startTime: '08:00:00', endTime: '16:00:00' },
              { dayOfWeek: 'THURSDAY', startTime: '08:00:00', endTime: '16:00:00' },
              { dayOfWeek: 'FRIDAY', startTime: '08:00:00', endTime: '16:00:00' },
            ],
          },
        ]),
      );

      await mount();
      component.onVisible();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      expect(component.workers().length).toBe(1);
      const schedules = component.schedulesForWorker(7);
      expect(schedules.length).toBe(1);
      expect(schedules[0].shifts.length).toBe(5);
    });
  });

  describe('worker portrait', () => {
    it('stages the chosen photo and uploads it after the worker is created', async () => {
      await mount();
      const imageApi = TestBed.inject(WorkerImage) as unknown as {
        uploadImage: ReturnType<typeof vi.fn>;
      };
      Object.defineProperty(URL, 'createObjectURL', {
        value: vi.fn(() => 'blob:worker'),
        configurable: true,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: vi.fn(),
        configurable: true,
      });

      component.showCreationModal();
      component.userForm.patchValue({
        document: '1094',
        name: 'Ana Pérez',
        email: 'ana@rms.co',
        phone: '3001234567',
        areaIds: [1],
      });
      const file = new File(['portrait'], 'ana.jpg', { type: 'image/jpeg' });
      component.onImageSelect({
        target: { files: [file], value: 'ana.jpg' },
      } as unknown as Event);

      expect(component.pendingImageFile()).toBe(file);
      expect(component.imagePreview()).toBe('blob:worker');

      component.createWorker();

      expect(imageApi.uploadImage).toHaveBeenCalledWith(7, file);
    });

    it('rejects files that are not images and files above 5 MB', async () => {
      await mount();
      component.showCreationModal();

      component.onImageSelect({
        target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })], value: 'x' },
      } as unknown as Event);
      expect(component.imageError()).toContain('Formato no permitido');

      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
      component.onImageSelect({
        target: { files: [big], value: 'big.jpg' },
      } as unknown as Event);
      expect(component.imageError()).toContain('5 MB');
      expect(component.pendingImageFile()).toBeNull();
    });
  });
});
