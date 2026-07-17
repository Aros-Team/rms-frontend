import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService } from 'primeng/api';

import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { WizardQuestionDraft } from '@app/core/services/combos/combo-wizard-state';
import { STEP_QUESTIONS_ID } from '../combo-wizard';

@Component({
  selector: 'app-questions-step[comboWizardStep=questions]',
  imports: [
    FormsModule,
    ButtonModule,
    CheckboxModule,
    ConfirmPopupModule,
    InputTextModule,
  ],
  templateUrl: './questions-step.html',
  styleUrl: './questions-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuestionsStep {
  private readonly wizard = inject(ComboWizardState);
  private readonly confirmationService = inject(ConfirmationService);

  readonly questions = computed<WizardQuestionDraft[]>(() =>
    this.wizard.data().questions,
  );

  constructor() {
    effect(() => {
      const qs = this.questions();
      const completed = qs.length === 0 || qs.every((q) => q.question.trim().length > 0);
      untracked(() => {
        if (completed) {
          this.wizard.markStepCompleted(STEP_QUESTIONS_ID);
        } else {
          this.wizard.markStepIncomplete(STEP_QUESTIONS_ID);
        }
      });
    });
  }

  addQuestion(): void {
    const current = this.questions();
    const newQuestion: WizardQuestionDraft = {
      id: null,
      question: '',
      required: false,
      displayOrder: current.length,
    };
    this.wizard.updateQuestions([...current, newQuestion]);
  }

  onQuestionChange(index: number, value: string): void {
    const updated = this.questions().map((q, i) =>
      i === index ? { ...q, question: value } : q,
    );
    this.wizard.updateQuestions(updated);
  }

  onRequiredChange(index: number, value: boolean): void {
    const updated = this.questions().map((q, i) =>
      i === index ? { ...q, required: value } : q,
    );
    this.wizard.updateQuestions(updated);
  }

  confirmRemove(event: Event, index: number): void {
    this.confirmationService.confirm({
      target: event.target as HTMLElement,
      message: '¿Eliminar esta pregunta?',
      accept: () => {
        this.removeQuestion(index);
      },
    });
  }

  private removeQuestion(index: number): void {
    const updated = this.questions()
      .filter((_, i) => i !== index)
      .map((q, i) => ({ ...q, displayOrder: i }));
    this.wizard.updateQuestions(updated);
  }
}
