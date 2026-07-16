import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { ComboWizard } from './combo-wizard';
import { GeneralStep } from './general-step/general-step';
import { GroupStep } from './group-step/group-step';
import { QuestionsStep } from './questions-step/questions-step';
import { PricingStep } from './pricing-step/pricing-step';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import { ComboSubmission } from './combo-submission';

@Component({
  selector: 'app-combo-wizard-page',
  imports: [
    ButtonModule,
    ToastModule,
    ComboWizard,
    GeneralStep,
    GroupStep,
    QuestionsStep,
    PricingStep,
  ],
  providers: [MessageService],
  template: `
    <p-toast />
    <app-combo-wizard>
      <app-general-step comboWizardStep="general" />
      @for (catId of categoryIds(); track catId) {
        <app-group-step comboWizardStep="category" [categoryId]="catId" />
      }
      <app-questions-step comboWizardStep="questions" />
      <app-pricing-step comboWizardStep="pricing" />

      <p-button
        footerActions
        label="Guardar combo"
        icon="pi pi-check"
        (onClick)="save()"
        [loading]="saving()"
      />
    </app-combo-wizard>
  `,
})
export class ComboWizardPage {
  private readonly wizard = inject(ComboWizardState);
  private readonly submission = inject(ComboSubmission);
  private readonly route = inject(ActivatedRoute);

  private readonly paramMap = toSignal(this.route.paramMap);

  readonly categoryIds = signal<number[]>([]);
  readonly saving = signal(false);

  constructor() {
    const id = this.paramMap()?.get('id');
    if (id) {
      const parsed = Number(id);
      if (!isNaN(parsed)) {
        this.wizard.hydrateFromCacheId(parsed);
      }
    } else {
      this.wizard.reset();
    }

    effect(() => {
      this.categoryIds.set(this.wizard.data().selectedCategoryIds);
    });
  }

  save(): void {
    this.saving.set(true);
    this.submission.submit().subscribe({
      next: () => { this.saving.set(false); },
      error: () => { this.saving.set(false); },
    });
  }
}
