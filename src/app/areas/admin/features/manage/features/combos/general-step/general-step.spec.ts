/**
 * Tests for the GeneralStep component (combo wizard step 1).
 *
 * Feature: General info form for combo (name, description, image).
 * Contract: Renders form fields, validates required fields, emits valid state.
 * Approach: Mount component via TestBed with test host, fill fields, assert validation state.
 */
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';

import type {
  WizardFormData,
  WizardGroupDraft,
} from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import type { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';
import { GeneralStep } from './general-step';
import generalStepHtml from './general-step.html?raw';
import buttonHtml from '@shared/ui/button/button.html?raw';
import fieldHtml from '@shared/ui/field/field.html?raw';
import iconButtonHtml from '@shared/ui/icon-button/icon-button.html?raw';
import inputHtml from '@shared/ui/input/input.html?raw';
import textareaHtml from '@shared/ui/textarea/textarea.html?raw';

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
  updateSchedule: ReturnType<typeof vi.fn>;
  markStepCompleted: ReturnType<typeof vi.fn>;
  markStepIncomplete: ReturnType<typeof vi.fn>;
  isStepCompleted: ReturnType<typeof vi.fn>;
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
    updateGroups: vi.fn((groups: WizardGroupDraft[]) => {
      data.update((d) => ({ ...d, groups }));
    }),
    updateSchedule: vi.fn((schedule: WizardFormData['schedule']) => {
      data.update((d) => ({ ...d, schedule }));
    }),
    markStepCompleted: vi.fn(),
    markStepIncomplete: vi.fn(),
    isStepCompleted: vi.fn().mockReturnValue(false),
  };
}

const mockCategories: CategorySimpleResponse[] = [
  { id: 10, name: 'Bebidas', enabled: true },
  { id: 20, name: 'Entradas', enabled: true },
  { id: 30, name: 'Postres', enabled: false },
];

interface ReferenceMock {
  categories: WritableSignal<CategorySimpleResponse[]>;
  products: WritableSignal<[]>;
  isLoading: WritableSignal<boolean>;
  loadIfStale: ReturnType<typeof vi.fn>;
  categoryName: ReturnType<typeof vi.fn>;
  categoryById: ReturnType<typeof vi.fn>;
}

function buildReferenceMock(): ReferenceMock {
  return {
    categories: signal<CategorySimpleResponse[]>([...mockCategories]),
    products: signal<[]>([]),
    isLoading: signal(false),
    loadIfStale: vi.fn(),
    categoryName: vi.fn((id: number) => mockCategories.find((c) => c.id === id)?.name),
    categoryById: vi.fn((id: number) => mockCategories.find((c) => c.id === id)),
  };
}

describe('GeneralStep', () => {
  let fixture: ComponentFixture<GeneralStep>;
  let component: GeneralStep;
  let wizardMock: WizardMock;
  let referenceMock: ReferenceMock;

  beforeAll(async () => {
    await resolveUiResources({
      'general-step.html': generalStepHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'field.html': fieldHtml as unknown as string,
      'icon-button.html': iconButtonHtml as unknown as string,
      'input.html': inputHtml as unknown as string,
      'textarea.html': textareaHtml as unknown as string,
    });
  });

  function createComponent(initialData?: Partial<WizardFormData>): void {
    wizardMock = buildWizardMock(initialData);
    referenceMock = buildReferenceMock();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [GeneralStep],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: ComboWizardState, useValue: wizardMock },
        { provide: ComboReferenceCache, useValue: referenceMock },
      ],
    });
    fixture = TestBed.createComponent(GeneralStep);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function getNative(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  describe('form fields rendering', () => {
    it('renders name input', async () => {
      createComponent({ name: 'Combo Test' });
      await Promise.resolve();
      fixture.detectChanges();
      const input = getNative().querySelector<HTMLInputElement>(
        'app-rms-input[data-testid="name-input"] input',
      );
      expect(input?.id).toBe('name');
      expect(input?.value).toBe('Combo Test');
      expect(getNative().querySelector('label[for="name"]')?.textContent.trim()).toBe(
        'Nombre del combo',
      );
    });

    it('renders description textarea', async () => {
      createComponent({ description: 'Sopa + plato' });
      await Promise.resolve();
      fixture.detectChanges();
      const textarea = getNative().querySelector<HTMLTextAreaElement>(
        'app-rms-textarea[data-testid="description-input"] textarea',
      );
      expect(textarea?.id).toBe('description');
      expect(textarea?.rows).toBe(3);
      expect(textarea?.value).toBe('Sopa + plato');
      expect(getNative().querySelector('label[for="description"]')?.textContent.trim()).toBe(
        'Descripción',
      );
    });

    it('renders scheduling required checkbox', () => {
      createComponent();
      const host = getNative().querySelector('[data-testid="scheduling-required-checkbox"]');
      expect(host?.querySelector('input[type="checkbox"]')?.getAttribute('id')).toBe(
        'schedulingRequired',
      );
      expect(getNative().querySelector('label[for="schedulingRequired"]')?.textContent.trim()).toBe(
        'Horario requerido',
      );
    });

    it('renders category chips', () => {
      createComponent();
      const chips = Array.from(
        getNative().querySelectorAll('[data-testid="category-chips"] p-chip'),
      );
      expect(chips.map((chip) => chip.textContent.trim())).toEqual([
        'Bebidas',
        'Entradas',
        'Postres',
      ]);
    });

    it('sets name from wizard initial data', () => {
      createComponent({ name: 'Combo Test' });
      expect(wizardMock.data().name).toBe('Combo Test');
    });
  });

  describe('name input updates wizard state', () => {
    it('calls updateData on name change', () => {
      createComponent({ name: 'Original' });
      const input = getNative().querySelector<HTMLInputElement>(
        'app-rms-input[data-testid="name-input"] input',
      );
      if (!(input instanceof HTMLInputElement)) {
        throw new Error('name input not found');
      }

      input.value = 'Nuevo nombre';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ name: 'Nuevo nombre' });
    });
  });

  describe('category multi-select generates group drafts', () => {
    it('creates a group for a newly selected category', () => {
      createComponent();
      component.onCategoriesChange([10]);
      fixture.detectChanges();

      expect(wizardMock.updateSelectedCategoryIds).toHaveBeenCalledWith([10]);
      expect(wizardMock.updateGroups).toHaveBeenCalled();
      const groups = wizardMock.data().groups;
      expect(groups.length).toBe(1);
      expect(groups[0]?.categoryId).toBe(10);
      expect(groups[0]?.required).toBe(true);
      expect(groups[0]?.minSelections).toBe(1);
      expect(groups[0]?.maxSelections).toBe(1);
    });

    it('preserves existing group properties when category is kept', () => {
      createComponent({
        selectedCategoryIds: [10, 20],
        groups: [
          {
            id: 5,
            categoryId: 10,
            displayOrder: 0,
            required: true,
            minSelections: 1,
            maxSelections: 2,
            productIds: [100, 101],
          },
        ],
      });
      fixture.detectChanges();

      component.onCategoriesChange([10, 20]);
      fixture.detectChanges();

      const groups = wizardMock.data().groups;
      const keptGroup = groups.find((g) => g.categoryId === 10);
      expect(keptGroup?.productIds).toEqual([100, 101]);
      expect(keptGroup?.maxSelections).toBe(2);

      const newGroup = groups.find((g) => g.categoryId === 20);
      expect(newGroup?.productIds).toEqual([]);
      expect(newGroup?.required).toBe(true);
    });
  });

  describe('removing a category removes its group', () => {
    it('removes the group when category is deselected', () => {
      createComponent({
        selectedCategoryIds: [10, 20],
        groups: [
          {
            id: 5,
            categoryId: 10,
            displayOrder: 0,
            required: true,
            minSelections: 1,
            maxSelections: 1,
            productIds: [],
          },
          {
            id: 6,
            categoryId: 20,
            displayOrder: 1,
            required: true,
            minSelections: 1,
            maxSelections: 1,
            productIds: [],
          },
        ],
      });
      fixture.detectChanges();

      component.onCategoriesChange([10]);
      fixture.detectChanges();

      const groups = wizardMock.data().groups;
      expect(groups.length).toBe(1);
      expect(groups.every((g) => g.categoryId !== 20)).toBe(true);
    });
  });

  describe('step auto-completes when name set', () => {
    it('calls markStepCompleted when name is present', () => {
      createComponent({ name: 'Mi combo' });
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('general');
    });

    it('calls markStepIncomplete when name is empty', () => {
      createComponent({ name: '' });
      fixture.detectChanges();

      expect(wizardMock.markStepIncomplete).toHaveBeenCalledWith('general');
    });
  });

  describe('schedule editor', () => {
    it('does not show schedule editor when schedulingRequired is false', () => {
      createComponent({ schedulingRequired: false });
      fixture.detectChanges();

      const editor = getNative().querySelector('[data-testid="schedule-editor"]');
      expect(editor).toBeNull();
    });

    it('shows schedule editor when schedulingRequired is true', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      const editor = getNative().querySelector('[data-testid="schedule-editor"]');
      expect(editor?.querySelector('span')?.textContent.trim()).toBe('Horario');
    });

    it('adds a schedule block', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      component.addScheduleBlock();
      fixture.detectChanges();

      expect(component.scheduleBlocksForDisplay().length).toBe(1);
      expect(wizardMock.updateSchedule).toHaveBeenCalled();
    });

    it('toggles days in a block and syncs to wizard', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      component.addScheduleBlock();
      const block = component.scheduleBlocksForDisplay().at(0);
      if (!block) {
        throw new Error('Expected schedule block to be created');
      }
      component.toggleBlockDay(block.id, 'MONDAY');
      fixture.detectChanges();

      const schedule = wizardMock.data().schedule;
      expect(schedule.length).toBe(1);
      expect(schedule[0]?.dayOfWeek).toBe('MONDAY');
    });

    it('removes a schedule block', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      component.addScheduleBlock();
      const block = component.scheduleBlocksForDisplay().at(0);
      if (!block) {
        throw new Error('Expected schedule block to be created');
      }
      component.toggleBlockDay(block.id, 'MONDAY');
      component.toggleBlockDay(block.id, 'TUESDAY');
      component.removeScheduleBlock(block.id);
      fixture.detectChanges();

      expect(wizardMock.data().schedule.length).toBe(0);
    });
  });

  describe('loading state', () => {
    it('shows skeleton when reference cache is loading', () => {
      createComponent();
      referenceMock.isLoading.set(true);
      fixture.detectChanges();

      const skeleton = getNative().querySelector('[data-testid="loading-skeleton"]');
      expect(skeleton?.querySelectorAll('p-skeleton').length).toBe(6);
      expect(getNative().querySelector('[data-testid="name-input"]')).toBeNull();
    });

    it('hides skeleton when reference cache finishes loading', () => {
      createComponent();
      referenceMock.isLoading.set(false);
      fixture.detectChanges();

      const skeleton = getNative().querySelector('[data-testid="loading-skeleton"]');
      expect(skeleton).toBeNull();
    });
  });
});
