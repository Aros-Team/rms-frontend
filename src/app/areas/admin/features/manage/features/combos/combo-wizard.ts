import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
} from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { TimelineModule } from 'primeng/timeline';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import {
  ComboWizardState,
  type WizardStep,
  type WizardStepId,
} from '@app/core/services/combos/combo-wizard-state';

export const STEP_GENERAL_ID: WizardStepId = 'general';
export const STEP_QUESTIONS_ID: WizardStepId = 'questions';
export const STEP_PRICING_ID: WizardStepId = 'pricing';
const STEP_CATEGORY_PREFIX = 'category:';

export function categoryStepId(id: number): WizardStepId {
  return `${STEP_CATEGORY_PREFIX}${String(id)}`;
}

export function isCategoryStepId(id: WizardStepId): boolean {
  return id.startsWith(STEP_CATEGORY_PREFIX);
}

export type StepMarkerState = 'active' | 'completed' | 'inactive';

export interface WizardStepView {
  id: WizardStepId;
  label: string;
  marker: StepMarkerState;
  isCurrent: boolean;
  isCompleted: boolean;
  slotKey: 'general' | 'category' | 'questions' | 'pricing';
}

const STEP_GENERAL_LABEL = 'Información general';
const STEP_QUESTIONS_LABEL = 'Preguntas';
const STEP_PRICING_LABEL = 'Precio final';

@Component({
  selector: 'app-combo-wizard',
  imports: [ButtonModule, SkeletonModule, TimelineModule],
  templateUrl: './combo-wizard.html',
  styleUrl: './combo-wizard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboWizard {
  private readonly wizard = inject(ComboWizardState);
  private readonly reference = inject(ComboReferenceCache);
  private readonly hostElement = inject(ElementRef);

  readonly sourceId = this.wizard.sourceId;
  readonly canGoBack = this.wizard.canGoBack;
  readonly canAdvance = this.wizard.canAdvance;

  readonly pageTitle = computed(() =>
    this.sourceId() === null ? 'Asistente de combo' : 'Editar combo',
  );

  readonly pageDescription = computed(() =>
    this.sourceId() === null
      ? 'Crea una combinación especial paso a paso.'
      : 'Modifica la combinación especial paso a paso.',
  );

  readonly hasNoCategories = computed(() => this.wizard.data().selectedCategoryIds.length === 0);

  hasSlotContent(slotKey: string): boolean {
    return !!(this.hostElement.nativeElement as HTMLElement).querySelector(
      `[comboWizardStep="${slotKey}"]`,
    );
  }

  readonly wizardSteps = computed<WizardStep[]>(() => {
    const categoryIds = this.wizard.data().selectedCategoryIds;
    const steps: WizardStep[] = [{ id: STEP_GENERAL_ID, label: STEP_GENERAL_LABEL }];
    for (const categoryId of categoryIds) {
      steps.push({
        id: categoryStepId(categoryId),
        label: this.reference.categoryName(categoryId) ?? `Categoría #${String(categoryId)}`,
      });
    }
    steps.push({ id: STEP_QUESTIONS_ID, label: STEP_QUESTIONS_LABEL });
    steps.push({ id: STEP_PRICING_ID, label: STEP_PRICING_LABEL });
    return steps;
  });

  readonly stepView = computed<WizardStepView[]>(() => {
    const currentId = this.wizard.currentStepId();
    const completed = this.wizard.completedSteps();
    return this.wizard.steps().map((step) => {
      const isCurrent = step.id === currentId;
      const isCompleted = !isCurrent && completed.has(step.id);
      const marker: StepMarkerState = isCurrent
        ? 'active'
        : isCompleted
          ? 'completed'
          : 'inactive';
      return {
        id: step.id,
        label: step.label,
        marker,
        isCurrent,
        isCompleted,
        slotKey: this.slotKeyFor(step.id),
      };
    });
  });

  constructor() {
    effect(() => {
      this.wizard.setSteps(this.wizardSteps());
    });
  }

  onBack(): void {
    this.wizard.goBack();
  }

  onNext(): void {
    if (!this.canAdvance()) {
      return;
    }
    this.wizard.goNext();
  }

  markerIcon(state: StepMarkerState): string {
    if (state === 'active') {
      return 'pi pi-circle-fill';
    }
    if (state === 'completed') {
      return 'pi pi-check';
    }
    return 'pi pi-circle';
  }

  markerClass(state: StepMarkerState): string {
    if (state === 'completed') {
      return 'bg-primary text-primary-contrast border border-primary';
    }
    if (state === 'active') {
      return 'bg-primary-contrast text-primary border-2 border-primary';
    }
    return 'bg-surface-100 text-surface-500 border border-surface-300 dark:bg-surface-800 dark:text-surface-400 dark:border-surface-600';
  }

  markerConnectorClass(state: StepMarkerState): string {
    return state === 'completed'
      ? 'bg-primary'
      : 'bg-surface-200 dark:bg-surface-700';
  }

  statusLabel(state: StepMarkerState): string {
    if (state === 'active') {
      return 'Actual';
    }
    if (state === 'completed') {
      return 'Completado';
    }
    return 'Pendiente';
  }

  statusClass(state: StepMarkerState): string {
    if (state === 'active') {
      return 'text-primary';
    }
    if (state === 'completed') {
      return 'text-primary';
    }
    return 'text-surface-500 dark:text-surface-400';
  }

  private slotKeyFor(id: WizardStepId): WizardStepView['slotKey'] {
    if (id === STEP_GENERAL_ID) {
      return 'general';
    }
    if (id === STEP_QUESTIONS_ID) {
      return 'questions';
    }
    if (id === STEP_PRICING_ID) {
      return 'pricing';
    }
    return 'category';
  }
}
