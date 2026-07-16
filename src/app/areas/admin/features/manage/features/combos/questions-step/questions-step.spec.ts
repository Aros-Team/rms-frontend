import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  signal,
  type WritableSignal,
} from '@angular/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';

import { ConfirmationService } from 'primeng/api';

import type { WizardFormData } from '@app/core/services/combos/combo-wizard-state';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';

import { QuestionsStep } from './questions-step';
import questionsStepHtml from './questions-step.html?raw';

function emptyFormData(): WizardFormData {
  return {
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
  };
}

interface WizardMock {
  data: WritableSignal<WizardFormData>;
  updateData: ReturnType<typeof vi.fn>;
  updateSelectedCategoryIds: ReturnType<typeof vi.fn>;
  updateGroups: ReturnType<typeof vi.fn>;
  updateQuestions: ReturnType<typeof vi.fn>;
  updateSchedule: ReturnType<typeof vi.fn>;
  markStepCompleted: ReturnType<typeof vi.fn>;
  markStepIncomplete: ReturnType<typeof vi.fn>;
  isStepCompleted: ReturnType<typeof vi.fn>;
}

function buildConfirmationMock() {
  const requireConfirmation$ = new Subject();
  return {
    requireConfirmation$,
    confirm: vi.fn((config: { accept?: () => void }) => {
      requireConfirmation$.next(config);
      config.accept?.();
    }),
  };
}

function buildWizardMock(initial?: Partial<WizardFormData>): WizardMock {
  const data = signal<WizardFormData>({ ...emptyFormData(), ...initial });
  return {
    data,
    updateData: vi.fn((partial: Partial<WizardFormData>) => {
      data.update((d) => ({ ...d, ...partial }));
    }),
    updateSelectedCategoryIds: vi.fn((ids: readonly number[]) => {
      data.update((d) => ({ ...d, selectedCategoryIds: [...ids] }));
    }),
    updateGroups: vi.fn((groups: WizardFormData['groups']) => {
      data.update((d) => ({ ...d, groups }));
    }),
    updateQuestions: vi.fn((questions: WizardFormData['questions']) => {
      data.update((d) => ({ ...d, questions }));
    }),
    updateSchedule: vi.fn(),
    markStepCompleted: vi.fn(),
    markStepIncomplete: vi.fn(),
    isStepCompleted: vi.fn().mockReturnValue(false),
  };
}

describe('QuestionsStep', () => {
  let fixture: ComponentFixture<QuestionsStep>;
  let component: QuestionsStep;
  let wizardMock: WizardMock;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('questions-step.html')) {
        return Promise.resolve(questionsStepHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  function createComponent(initialData?: Partial<WizardFormData>): void {
    wizardMock = buildWizardMock(initialData);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [QuestionsStep],
      providers: [
        { provide: ComboWizardState, useValue: wizardMock },
        { provide: ConfirmationService, useValue: buildConfirmationMock() },
      ],
    });
    fixture = TestBed.createComponent(QuestionsStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function getNative(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('empty state', () => {
    it('renders empty state when no questions', () => {
      createComponent();
      const emptyState = getNative().querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState?.textContent).toContain(
        'No hay preguntas configuradas',
      );
    });

    it('does not render questions list when empty', () => {
      createComponent();
      const list = getNative().querySelector('[data-testid="questions-list"]');
      expect(list).toBeNull();
    });
  });

  describe('adding questions', () => {
    it('"Agregar pregunta" button exists when empty', () => {
      createComponent();
      const btn = getNative().querySelector('[data-testid="add-question-btn"]');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('Agregar pregunta');
    });

    it('addQuestion adds a question to wizard state', () => {
      createComponent();
      component.addQuestion();
      fixture.detectChanges();

      expect(wizardMock.updateQuestions).toHaveBeenCalled();
      const questions = wizardMock.data().questions;
      expect(questions.length).toBe(1);
      expect(questions[0]?.question).toBe('');
      expect(questions[0]?.required).toBe(false);
      expect(questions[0]?.displayOrder).toBe(0);
    });

    it('renders question rows after adding', () => {
      createComponent();
      component.addQuestion();
      fixture.detectChanges();

      const emptyState = getNative().querySelector('[data-testid="empty-state"]');
      expect(emptyState).toBeNull();

      const rows = getNative().querySelectorAll('[data-testid="question-row"]');
      expect(rows.length).toBe(1);
    });

    it('auto-assigns displayOrder based on index', () => {
      createComponent();
      component.addQuestion();
      component.addQuestion();
      fixture.detectChanges();

      const questions = wizardMock.data().questions;
      expect(questions.length).toBe(2);
      expect(questions[0]?.displayOrder).toBe(0);
      expect(questions[1]?.displayOrder).toBe(1);
    });
  });

  describe('question text input', () => {
    it('onQuestionChange updates wizard state', () => {
      createComponent();
      component.addQuestion();
      fixture.detectChanges();

      component.onQuestionChange(0, '¿Cuál es tu color favorito?');
      fixture.detectChanges();

      expect(wizardMock.updateQuestions).toHaveBeenCalled();
      const questions = wizardMock.data().questions;
      expect(questions[0]?.question).toBe('¿Cuál es tu color favorito?');
    });
  });

  describe('required toggle', () => {
    it('onRequiredChange updates wizard state', () => {
      createComponent();
      component.addQuestion();
      fixture.detectChanges();

      component.onRequiredChange(0, true);
      fixture.detectChanges();

      const questions = wizardMock.data().questions;
      expect(questions[0]?.required).toBe(true);
    });

    it('shows (Obligatorio) label on each question row', () => {
      createComponent();
      component.addQuestion();
      fixture.detectChanges();

      const label = getNative().querySelector('label');
      expect(label?.textContent).toContain('(Obligatorio)');
    });
  });

  describe('remove button', () => {
    it('confirmRemove calls confirmation service', () => {
      createComponent();
      component.addQuestion();
      component.addQuestion();
      fixture.detectChanges();

      expect(wizardMock.data().questions.length).toBe(2);

      const event = new Event('click');
      component.confirmRemove(event, 0);

      expect(wizardMock.data().questions.length).toBe(1);
      expect(wizardMock.data().questions[0]?.displayOrder).toBe(0);
    });

    it('re-indexes displayOrder after removal', () => {
      createComponent();
      component.addQuestion();
      component.addQuestion();
      component.addQuestion();
      fixture.detectChanges();

      const event = new Event('click');
      component.confirmRemove(event, 1);

      const questions = wizardMock.data().questions;
      expect(questions.length).toBe(2);
      expect(questions[0]?.displayOrder).toBe(0);
      expect(questions[1]?.displayOrder).toBe(1);
    });
  });

  describe('step auto-completion', () => {
    it('auto-completes when no questions exist', () => {
      createComponent();
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('questions');
    });

    it('auto-completes when all questions have non-empty text', () => {
      createComponent();
      component.addQuestion();
      component.onQuestionChange(0, 'Pregunta válida');
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('questions');
    });

    it('auto-incompletes when any question has empty text', () => {
      createComponent();
      component.addQuestion();
      component.onQuestionChange(0, 'Pregunta válida');
      component.addQuestion();
      fixture.detectChanges();

      expect(wizardMock.markStepIncomplete).toHaveBeenCalledWith('questions');
    });

    it('completes again when empty question is filled', () => {
      createComponent();
      component.addQuestion();
      component.addQuestion();
      fixture.detectChanges();

      expect(wizardMock.markStepIncomplete).toHaveBeenCalledWith('questions');

      component.onQuestionChange(0, 'Primera pregunta');
      component.onQuestionChange(1, 'Segunda pregunta');
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('questions');
    });

    it('completes when last remaining question is removed', () => {
      createComponent();
      component.addQuestion();
      component.onQuestionChange(0, 'Única pregunta');
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('questions');

      const event = new Event('click');
      component.confirmRemove(event, 0);
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('questions');
    });
  });
});
