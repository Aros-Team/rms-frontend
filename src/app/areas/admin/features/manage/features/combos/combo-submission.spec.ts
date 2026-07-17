import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { MessageService } from 'primeng/api';

import { ComboSubmission } from './combo-submission';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import { Product } from '@app/core/services/products/product';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import type { ProductResponse } from '@app/shared/models/dto/products/product-response';
import type { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';

function buildWizardStub(overrides?: Partial<{
  sourceId: number | null;
  data: WizardFormData;
}>) {
  const sourceId = signal<number | null>(overrides?.sourceId ?? null);
  const data = signal<WizardFormData>(
    overrides?.data ?? {
      name: '',
      description: '',
      basePrice: null,
      areaId: null,
      active: true,
      baseRecipeEnabled: false,
      schedulingRequired: false,
      selectedCategoryIds: [],
      groups: [],
      additions: [],
      questions: [],
      schedule: [],
    },
  );
  return {
    sourceId: sourceId.asReadonly(),
    data: data.asReadonly(),
    markSaved: vi.fn(),
    discardDraft: vi.fn(),
  };
}

function setupTestBed(wizardStub?: ReturnType<typeof buildWizardStub>) {
  const ws = wizardStub ?? buildWizardStub();
  const cacheStub = {
    create: vi.fn(),
    update: vi.fn(),
  };
  const productStub = {
    createProduct: vi.fn(),
  };
  const messageStub = { add: vi.fn() };
  const routerStub = { navigate: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      ComboSubmission,
      { provide: ComboWizardState, useValue: ws },
      { provide: SpecialSelectionsCacheService, useValue: cacheStub },
      { provide: Product, useValue: productStub },
      { provide: MessageService, useValue: messageStub },
      { provide: Router, useValue: routerStub },
    ],
  });

  return { service: TestBed.inject(ComboSubmission), ws, cacheStub, productStub, messageStub, routerStub };
}

const fullFormData: WizardFormData = {
  name: 'Combo Ejecutivo',
  description: 'Sopa + Plato fuerte + Postre',
  basePrice: 15.5,
  areaId: 3,
  active: true,
  baseRecipeEnabled: false,
  schedulingRequired: true,
  selectedCategoryIds: [1, 2],
  groups: [
    { id: 10, categoryId: 1, displayOrder: 0, required: true, minSelections: 1, maxSelections: 1, productIds: [100] },
    { id: null, categoryId: 2, displayOrder: 1, required: false, minSelections: 0, maxSelections: 2, productIds: [200, 201] },
  ],
  additions: [
    { id: 1, name: 'Queso', optionId: 5, extraPrice: 1.5, displayOrder: 0 },
    { id: null, name: 'Tocineta', optionId: 6, extraPrice: 2, displayOrder: 1 },
  ],
  questions: [
    { id: 1, question: '¿Sin picante?', required: false, displayOrder: 0 },
    { id: null, question: '¿Para llevar?', required: true, displayOrder: 1 },
  ],
  schedule: [
    { dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '15:00' },
    { dayOfWeek: 'WEDNESDAY', startTime: '12:00', endTime: '16:00' },
  ],
};

describe('ComboSubmission', () => {
  describe('buildRequest', () => {
    it('maps WizardFormData to SpecialSelectionRequest correctly', () => {
      const { service } = setupTestBed(
        buildWizardStub({ sourceId: 42, data: fullFormData }),
      );

      const serviceAny = service as unknown as { buildRequest: (d: WizardFormData) => SpecialSelectionRequest };
      const req = serviceAny.buildRequest(fullFormData);

      expect(req.name).toBe('Combo Ejecutivo');
      expect(req.description).toBe('Sopa + Plato fuerte + Postre');
      expect(req.basePrice).toBe(15.5);
      expect(req.active).toBe(true);
      expect(req.baseRecipeEnabled).toBe(false);
      expect(req.schedulingRequired).toBe(true);
      expect(req.productId).toBe(42);
    });

    it('renumbers displayOrder on groups', () => {
      const { service } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );

      const serviceAny = service as unknown as { buildRequest: (d: WizardFormData) => SpecialSelectionRequest };
      const req = serviceAny.buildRequest(fullFormData);

      expect(req.groups.length).toBe(2);
      expect(req.groups[0].displayOrder).toBe(1);
      expect(req.groups[1].displayOrder).toBe(2);
    });

    it('strips null id to undefined for groups (create)', () => {
      const { service } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );

      const serviceAny = service as unknown as { buildRequest: (d: WizardFormData) => SpecialSelectionRequest };
      const req = serviceAny.buildRequest(fullFormData);

      expect(req.groups[0].id).toBe(10);
      expect(req.groups[1].id).toBeUndefined();
    });

    it('sets null basePrice to 0', () => {
      const zeroPriceData: WizardFormData = {
        ...fullFormData,
        basePrice: null,
      };
      const { service } = setupTestBed(
        buildWizardStub({ sourceId: null, data: zeroPriceData }),
      );

      const serviceAny = service as unknown as { buildRequest: (d: WizardFormData) => SpecialSelectionRequest };
      const req = serviceAny.buildRequest(zeroPriceData);

      expect(req.basePrice).toBe(0);
    });

    it('maps additions, questions, and schedule', () => {
      const { service } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );

      const serviceAny = service as unknown as { buildRequest: (d: WizardFormData) => SpecialSelectionRequest };
      const req = serviceAny.buildRequest(fullFormData);

      expect(req.additions).toEqual([
        { name: 'Queso', optionId: 5, extraPrice: 1.5, displayOrder: 0 },
        { name: 'Tocineta', optionId: 6, extraPrice: 2, displayOrder: 1 },
      ]);
      expect(req.questions).toEqual([
        { question: '¿Sin picante?', required: false, displayOrder: 0 },
        { question: '¿Para llevar?', required: true, displayOrder: 1 },
      ]);
      expect(req.schedule).toEqual([
        { dayOfWeek: 'MONDAY', startTime: '11:00', endTime: '15:00' },
        { dayOfWeek: 'WEDNESDAY', startTime: '12:00', endTime: '16:00' },
      ]);
    });
  });

  describe('submit', () => {
    it('creates product then calls create when sourceId is null', () => {
      const { service, cacheStub, productStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );
      const mockProduct = { id: 99 } as ProductResponse;
      productStub.createProduct.mockReturnValue(of(mockProduct));
      cacheStub.create.mockReturnValue(of({ id: 1 }));

      service.submit().subscribe((success) => {
        expect(success).toBe(true);
      });

      expect(productStub.createProduct).toHaveBeenCalledTimes(1);
      expect(cacheStub.create).toHaveBeenCalledTimes(1);
      expect(cacheStub.update).not.toHaveBeenCalled();
      const req = cacheStub.create.mock.calls[0][0] as SpecialSelectionRequest;
      expect(req.productId).toBe(99);
      expect(req.name).toBe('Combo Ejecutivo');
    });

    it('calls update when sourceId is not null', () => {
      const { service, cacheStub } = setupTestBed(
        buildWizardStub({ sourceId: 42, data: fullFormData }),
      );
      cacheStub.update.mockReturnValue(of({ id: 42 }));

      service.submit().subscribe((success) => {
        expect(success).toBe(true);
      });

      expect(cacheStub.update).toHaveBeenCalledTimes(1);
      expect(cacheStub.update).toHaveBeenCalledWith(42, expect.any(Object));
      expect(cacheStub.create).not.toHaveBeenCalled();
    });

    it('on success calls markSaved, discardDraft, navigates, and shows success message', () => {
      const { service, ws, cacheStub, productStub, messageStub, routerStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );
      productStub.createProduct.mockReturnValue(of({ id: 99 }));
      cacheStub.create.mockReturnValue(of({ id: 1 }));

      service.submit().subscribe();

      expect(ws.markSaved).toHaveBeenCalledTimes(1);
      expect(ws.discardDraft).toHaveBeenCalledTimes(1);
      expect(routerStub.navigate).toHaveBeenCalledWith(['/admin/manage/combos']);
      expect(messageStub.add).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Combo guardado correctamente',
      });
    });

    it('on HttpErrorResponse from cache.create shows error message and does not navigate', () => {
      const { service, cacheStub, productStub, messageStub, routerStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );
      productStub.createProduct.mockReturnValue(of({ id: 99 }));
      const httpErr = new HttpErrorResponse({ status: 409, error: { message: 'Conflicto' } });
      cacheStub.create.mockReturnValue(throwError(() => httpErr));

      service.submit().subscribe((success) => {
        expect(success).toBe(false);
      });

      expect(messageStub.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'Este menú no está disponible en este horario',
      });
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    it('on HttpErrorResponse from product creation shows error message and does not navigate', () => {
      const { service, cacheStub, productStub, messageStub, routerStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );
      const httpErr = new HttpErrorResponse({ status: 400, error: { message: 'Bad request' } });
      productStub.createProduct.mockReturnValue(throwError(() => httpErr));

      service.submit().subscribe((success) => {
        expect(success).toBe(false);
      });

      expect(productStub.createProduct).toHaveBeenCalledTimes(1);
      expect(cacheStub.create).not.toHaveBeenCalled();
      expect(cacheStub.update).not.toHaveBeenCalled();
      expect(messageStub.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'Bad request',
      });
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    it('on non-HTTP error shows generic error message', () => {
      const { service, cacheStub, productStub, messageStub, routerStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );
      productStub.createProduct.mockReturnValue(of({ id: 99 }));
      cacheStub.create.mockReturnValue(throwError(() => new Error('Network fail')));

      service.submit().subscribe((success) => {
        expect(success).toBe(false);
      });

      expect(messageStub.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar el combo',
      });
      expect(routerStub.navigate).not.toHaveBeenCalled();
    });

    it('returns Observable<boolean> with true on success and false on error', () => {
      const { service, cacheStub, productStub } = setupTestBed(
        buildWizardStub({ sourceId: null, data: fullFormData }),
      );

      productStub.createProduct.mockReturnValue(of({ id: 99 }));
      cacheStub.create.mockReturnValue(of({ id: 1 }));
      service.submit().subscribe((success) => {
        expect(success).toBe(true);
      });

      productStub.createProduct.mockReturnValue(of({ id: 99 }));
      cacheStub.create.mockReturnValue(throwError(() => new Error()));
      service.submit().subscribe((success) => {
        expect(success).toBe(false);
      });
    });
  });
});
