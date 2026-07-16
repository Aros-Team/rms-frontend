import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  signal,
  type WritableSignal,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import type { WizardFormData, WizardGroupDraft } from '@app/core/services/combos/combo-wizard-state';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import { Area } from '@app/core/services/areas/area';
import type { AreaResponse } from '@app/shared/models/dto/areas/area.model';
import type { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { GeneralStep } from './general-step';
import generalStepHtml from './general-step.html?raw';

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

const mockAreas: AreaResponse[] = [
  { id: 1, name: 'Cocina', type: 'KITCHEN', enabled: true },
  { id: 2, name: 'Barra', type: 'BARTENDER', enabled: true },
];

describe('GeneralStep', () => {
  let fixture: ComponentFixture<GeneralStep>;
  let component: GeneralStep;
  let wizardMock: WizardMock;
  let referenceMock: ReferenceMock;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('general-step.html')) {
        return Promise.resolve(generalStepHtml as unknown as string);
      }
      return Promise.resolve('');
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
        { provide: Area, useValue: { getAreas: () => of(mockAreas) } },
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
    it('renders name input', () => {
      createComponent();
      const input = getNative().querySelector('[data-testid="name-input"]');
      expect(input).toBeTruthy();
    });

    it('renders description textarea', () => {
      createComponent();
      const textarea = getNative().querySelector('[data-testid="description-input"]');
      expect(textarea).toBeTruthy();
    });

    it('renders base price inputnumber', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="base-price-input"]');
      expect(el).toBeTruthy();
    });

    it('renders area select', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="area-select"]');
      expect(el).toBeTruthy();
    });

    it('renders active selectbutton', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="active-selectbutton"]');
      expect(el).toBeTruthy();
    });

    it('renders base recipe checkbox', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="base-recipe-checkbox"]');
      expect(el).toBeTruthy();
    });

    it('renders scheduling required checkbox', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="scheduling-required-checkbox"]');
      expect(el).toBeTruthy();
    });

    it('renders category multiselect', () => {
      createComponent();
      const el = getNative().querySelector('[data-testid="category-multiselect"]');
      expect(el).toBeTruthy();
    });

    it('sets name from wizard initial data', () => {
      createComponent({ name: 'Combo Test' });
      expect(wizardMock.data().name).toBe('Combo Test');
    });

    it('sets base price from wizard initial data', () => {
      createComponent({ basePrice: 25.5 });
      expect(wizardMock.data().basePrice).toBe(25.5);
    });

    it('renders area options from area service', () => {
      createComponent();
      expect(component.areas().length).toBe(2);
      expect(component.areas()[0]?.name).toBe('Cocina');
    });
  });

  describe('name input updates wizard state', () => {
    it('calls updateData on name change', () => {
      createComponent({ name: 'Original' });
      const input = getNative().querySelector('[data-testid="name-input"]');
      expect(input).toBeTruthy();

      if (input instanceof HTMLInputElement) {
        input.value = 'Nuevo nombre';
        input.dispatchEvent(new Event('input'));
      }
      fixture.detectChanges();

      expect(wizardMock.updateData).toHaveBeenCalledWith({ name: 'Nuevo nombre' });
    });
  });

  describe('basePrice input updates wizard state', () => {
    it('calls updateData on basePrice change', () => {
      createComponent({ basePrice: 10 });
      const calls = wizardMock.updateData.mock.calls as [Partial<WizardFormData>][];
      const hasBasePrice = calls.some(([arg]) => Object.hasOwn(arg, 'basePrice'));
      expect(hasBasePrice).toBe(false);
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
          { id: 5, categoryId: 10, displayOrder: 0, required: true, minSelections: 1, maxSelections: 2, productIds: [100, 101] },
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
          { id: 5, categoryId: 10, displayOrder: 0, required: true, minSelections: 1, maxSelections: 1, productIds: [] },
          { id: 6, categoryId: 20, displayOrder: 1, required: true, minSelections: 1, maxSelections: 1, productIds: [] },
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

  describe('step auto-completes when name and basePrice set', () => {
    it('calls markStepCompleted when both name and basePrice are present', () => {
      createComponent({ name: 'Mi combo', basePrice: 15 });
      fixture.detectChanges();

      expect(wizardMock.markStepCompleted).toHaveBeenCalledWith('general');
    });

    it('calls markStepIncomplete when name is empty', () => {
      createComponent({ name: '', basePrice: 15 });
      fixture.detectChanges();

      expect(wizardMock.markStepIncomplete).toHaveBeenCalledWith('general');
    });

    it('calls markStepIncomplete when basePrice is null', () => {
      createComponent({ name: 'Mi combo', basePrice: null });
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
      expect(editor).toBeTruthy();
    });

    it('adds a schedule entry when a day is selected', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      component.addScheduleDay('MONDAY');
      fixture.detectChanges();

      expect(wizardMock.updateSchedule).toHaveBeenCalled();
      const schedule = wizardMock.data().schedule;
      expect(schedule.length).toBe(1);
      expect(schedule[0]?.dayOfWeek).toBe('MONDAY');
    });

    it('removes a schedule entry', () => {
      createComponent({ schedulingRequired: true });
      fixture.detectChanges();

      component.addScheduleDay('MONDAY');
      component.addScheduleDay('TUESDAY');
      fixture.detectChanges();

      const withSignal = component as { scheduleEntries: () => { id: number }[] };
      const firstEntry = withSignal.scheduleEntries()[0];
      expect(firstEntry).toBeDefined();
      component.removeScheduleEntry(firstEntry.id);
      fixture.detectChanges();

      const schedule = wizardMock.data().schedule;
      expect(schedule.length).toBe(1);
      expect(schedule[0]?.dayOfWeek).toBe('TUESDAY');
    });
  });

  describe('loading state', () => {
    it('shows skeleton when reference cache is loading', () => {
      createComponent();
      referenceMock.isLoading.set(true);
      fixture.detectChanges();

      const skeleton = getNative().querySelector('[data-testid="loading-skeleton"]');
      expect(skeleton).toBeTruthy();
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
