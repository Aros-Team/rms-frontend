import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { MessageService } from 'primeng/api';

import { ComboWizardState, type WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import { Product } from '@app/core/services/products/product';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { ProductCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { mapHttpError } from '@app/shared/lib/http-error-mapper';

@Injectable({ providedIn: 'root' })
export class ComboSubmission {
  private readonly wizard = inject(ComboWizardState);
  private readonly cache = inject(SpecialSelectionsCacheService);
  private readonly productService = inject(Product);
  private readonly message = inject(MessageService);
  private readonly router = inject(Router);

  submit(): Observable<boolean> {
    const data = this.wizard.data();
    const sourceId = this.wizard.sourceId();

    const obs = sourceId === null
      ? this.createProductAndSelection(data)
      : this.updateSelection(sourceId, data);

    return obs.pipe(
      map(() => {
        this.message.add({ severity: 'success', summary: 'Éxito', detail: 'Combo guardado correctamente' });
        this.wizard.markSaved();
        this.wizard.discardDraft();
        void this.router.navigate(['/admin/manage/combos']);
        return true;
      }),
      catchError((err: unknown) => {
        const detail = err instanceof HttpErrorResponse
          ? mapHttpError(err)
          : 'No se pudo guardar el combo';
        this.message.add({ severity: 'error', summary: 'Error', detail });
        return of(false);
      }),
    );
  }

  private createProductAndSelection(data: WizardFormData): Observable<SpecialSelectionResponse> {
    const createReq: ProductCreateRequest = {
      name: data.name,
      description: data.description,
      basePrice: Math.max(data.basePrice ?? 0, 1),
      categoryId: data.selectedCategoryIds[0] ?? 1,
      areaId: data.areaId ?? 1,
      recipe: [],
      selectionType: 'SPECIAL_SELECTION',
      baseRecipeEnabled: data.baseRecipeEnabled,
      schedulingRequired: data.schedulingRequired,
    };

    return this.productService.createProduct(createReq).pipe(
      switchMap((product) =>
        this.cache.create(this.buildCreateRequest(data, product.id)),
      ),
    );
  }

  private buildCreateRequest(data: WizardFormData, productId: number): SpecialSelectionRequest {
    return {
      productId,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice ?? 0,
      active: data.active,
      baseRecipeEnabled: data.baseRecipeEnabled,
      schedulingRequired: data.schedulingRequired,
      groups: data.groups.map((g, i) => ({
        id: g.id ?? undefined,
        categoryId: g.categoryId,
        displayOrder: i + 1,
        required: g.required,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        productIds: g.productIds,
      })),
      additions: data.additions.map((a) => ({
        name: a.name,
        optionId: a.optionId ?? 0,
        extraPrice: a.extraPrice,
        displayOrder: a.displayOrder,
      })),
      questions: data.questions.map((q) => ({
        question: q.question,
        required: q.required,
        displayOrder: q.displayOrder,
      })),
      schedule: data.schedule.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    };
  }

  private updateSelection(sourceId: number, data: WizardFormData): Observable<SpecialSelectionResponse> {
    return this.cache.update(sourceId, this.buildRequest(data));
  }

  private buildRequest(data: WizardFormData): SpecialSelectionRequest {
    const sourceId = this.wizard.sourceId();
    return {
      productId: sourceId ?? undefined,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice ?? 0,
      active: data.active,
      baseRecipeEnabled: data.baseRecipeEnabled,
      schedulingRequired: data.schedulingRequired,
      groups: data.groups.map((g, i) => ({
        id: g.id ?? undefined,
        categoryId: g.categoryId,
        displayOrder: i + 1,
        required: g.required,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        productIds: g.productIds,
      })),
      additions: data.additions.map((a) => ({
        name: a.name,
        optionId: a.optionId ?? 0,
        extraPrice: a.extraPrice,
        displayOrder: a.displayOrder,
      })),
      questions: data.questions.map((q) => ({
        question: q.question,
        required: q.required,
        displayOrder: q.displayOrder,
      })),
      schedule: data.schedule.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
    };
  }
}
