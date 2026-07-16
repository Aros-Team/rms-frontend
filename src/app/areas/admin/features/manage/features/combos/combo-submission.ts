import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { MessageService } from 'primeng/api';

import { ComboWizardState, type WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { mapHttpError } from '@app/shared/lib/http-error-mapper';

@Injectable({ providedIn: 'root' })
export class ComboSubmission {
  private readonly wizard = inject(ComboWizardState);
  private readonly cache = inject(SpecialSelectionsCacheService);
  private readonly message = inject(MessageService);
  private readonly router = inject(Router);

  submit(): Observable<boolean> {
    const data = this.wizard.data();
    const sourceId = this.wizard.sourceId();
    const req = this.buildRequest(data);

    const obs = sourceId === null
      ? this.cache.create(req)
      : this.cache.update(sourceId, req);

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

  private buildRequest(data: WizardFormData): SpecialSelectionRequest {
    const sourceId = this.wizard.sourceId();
    return {
      productId: sourceId ?? undefined,
      name: data.name,
      description: data.description,
      basePrice: data.basePrice ?? 0,
      areaId: data.areaId ?? 0,
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
