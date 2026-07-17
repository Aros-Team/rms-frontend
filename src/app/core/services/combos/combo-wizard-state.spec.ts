import { TestBed } from '@angular/core/testing';
import { effect, signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ComboWizardState, COMBO_WIZARD_DRAFT_STORAGE_KEY } from './combo-wizard-state';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { SpecialSelectionGroupResponse } from '@app/shared/models/dto/special-selections/special-selection-group';
import { SpecialSelectionAdditionResponse } from '@app/shared/models/dto/special-selections/special-selection-addition';
import { SpecialSelectionQuestionResponse } from '@app/shared/models/dto/special-selections/special-selection-question';
import { ScheduleEntryResponse } from '@app/shared/models/dto/special-selections/schedule-entry';

const STORAGE_KEY = COMBO_WIZARD_DRAFT_STORAGE_KEY;

function makeGroup(
  id: number,
  categoryId: number,
  order: number,
  required: boolean,
  productIds: number[],
): SpecialSelectionGroupResponse {
  return {
    id,
    categoryId,
    categoryName: `Categoría ${String(categoryId)}`,
    displayOrder: order,
    required,
    minSelections: required ? 1 : 0,
    maxSelections: 2,
    productIds,
  };
}

function makeAddition(id: number, name: string, price: number): SpecialSelectionAdditionResponse {
  return {
    id,
    name,
    optionId: id,
    optionName: `${name} (opción)`,
    extraPrice: price,
    displayOrder: 0,
  };
}

function makeQuestion(id: number, question: string, required: boolean): SpecialSelectionQuestionResponse {
  return {
    id,
    question,
    required,
    displayOrder: 0,
  };
}

function makeScheduleEntry(id: number): ScheduleEntryResponse {
  return {
    id,
    dayOfWeek: 'MONDAY',
    startTime: '11:00',
    endTime: '15:00',
  };
}

const mockResponse: SpecialSelectionResponse = {
  id: 42,
  name: 'Combo Almuerzo',
  description: 'Sopa + plato fuerte',
  basePrice: 12.5,
  active: true,
  preparationAreaId: 1,
  selectionType: 'SPECIAL_SELECTION',
  baseRecipeEnabled: true,
  schedulingRequired: true,
  groups: [
    makeGroup(10, 1, 0, true, [100]),
    makeGroup(11, 2, 1, false, [200, 201]),
    makeGroup(12, null, 2, false, [300]),
  ],
  additions: [makeAddition(1, 'Queso', 1.5)],
  questions: [makeQuestion(1, '¿Sin picante?', false)],
  schedule: [makeScheduleEntry(1)],
};

interface DetailStub {
  data: ReturnType<typeof signal<SpecialSelectionResponse | null>>;
  loadIfStale: ReturnType<typeof vi.fn>;
}

function buildCacheStub(initialResponse: SpecialSelectionResponse | null = null): {
  detail: ReturnType<typeof vi.fn>;
  lastDetail: DetailStub;
} {
  const lastDetail: DetailStub = {
    data: signal<SpecialSelectionResponse | null>(initialResponse),
    loadIfStale: vi.fn(),
  };
  const detail = vi.fn().mockReturnValue(lastDetail);
  return { detail, lastDetail };
}

function setupTestBed(cacheStub?: ReturnType<typeof buildCacheStub>): ComboWizardState {
  const stub = cacheStub ?? buildCacheStub(null);
  TestBed.configureTestingModule({
    providers: [
      ComboWizardState,
      { provide: SpecialSelectionsCacheService, useValue: stub },
    ],
  });
  return TestBed.inject(ComboWizardState);
}

describe('ComboWizardState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('initial state', () => {
    it('starts empty, clean, and without steps', () => {
      const state = setupTestBed();

      expect(state.sourceId()).toBeNull();
      expect(state.data().name).toBe('');
      expect(state.data().description).toBe('');
      expect(state.data().basePrice).toBeNull();
      expect(state.data().selectedCategoryIds).toEqual([]);
      expect(state.data().groups).toEqual([]);
      expect(state.data().additions).toEqual([]);
      expect(state.data().questions).toEqual([]);
      expect(state.data().schedule).toEqual([]);
      expect(state.dirty()).toBe(false);
      expect(state.lastSavedAt()).toBeNull();
      expect(state.lastPersistedAt()).toBeNull();
      expect(state.steps()).toEqual([]);
      expect(state.currentStepId()).toBeNull();
      expect(state.currentStep()).toBeNull();
      expect(state.currentStepIndex()).toBe(-1);
      expect(state.completedSteps().size).toBe(0);
      expect(state.canAdvance()).toBe(false);
      expect(state.canGoBack()).toBe(false);
      expect(state.canGoForward()).toBe(false);
    });
  });

  describe('hydration', () => {
    it('hydrateFromResponse(null) creates an empty draft and clears dirty', () => {
      const state = setupTestBed();
      state.updateData({ name: 'Borrador temporal' });
      expect(state.dirty()).toBe(true);

      state.hydrateFromResponse(null);

      expect(state.sourceId()).toBeNull();
      expect(state.data().name).toBe('');
      expect(state.dirty()).toBe(false);
      expect(state.lastSavedAt()).toBeNull();
      expect(state.completedSteps().size).toBe(0);
    });

    it('hydrateFromResponse(response) populates the draft from cache detail payload', () => {
      const state = setupTestBed();

      state.hydrateFromResponse(mockResponse);

      expect(state.sourceId()).toBe(42);
      expect(state.data().name).toBe('Combo Almuerzo');
      expect(state.data().description).toBe('Sopa + plato fuerte');
      expect(state.data().basePrice).toBe(12.5);
      expect(state.data().areaId).toBe(1);
      expect(state.data().active).toBe(true);
      expect(state.data().schedulingRequired).toBe(true);
      expect(state.data().selectedCategoryIds).toEqual([1, 2]);
      expect(state.data().groups.length).toBe(3);
      expect(state.data().groups[0].id).toBe(10);
      expect(state.data().groups[0].productIds).toEqual([100]);
      expect(state.data().groups[1].productIds).toEqual([200, 201]);
      expect(state.data().groups[2].categoryId).toBeNull();
      expect(state.data().additions[0].name).toBe('Queso');
      expect(state.data().questions[0].question).toBe('¿Sin picante?');
      expect(state.data().schedule[0].dayOfWeek).toBe('MONDAY');
      expect(state.dirty()).toBe(false);
      expect(state.lastSavedAt()).not.toBeNull();
    });

    it('hydrateFromResponse clears any persisted localStorage draft', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 1,
          sourceId: 99,
          data: mockResponse,
          updatedAt: 123456,
        }),
      );
      const state = setupTestBed();

      state.hydrateFromResponse(mockResponse);

      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('hydrateFromCacheId returns false when the cache has no data yet', () => {
      const stub = buildCacheStub(null);
      const state = setupTestBed(stub);

      const ok = state.hydrateFromCacheId(42);

      expect(ok).toBe(false);
      expect(stub.detail).toHaveBeenCalledWith(42);
      expect(stub.lastDetail.loadIfStale).toHaveBeenCalled();
      expect(state.sourceId()).toBeNull();
    });

    it('hydrateFromCacheId hydrates from the cache when data is already present', () => {
      const stub = buildCacheStub(mockResponse);
      const state = setupTestBed(stub);

      const ok = state.hydrateFromCacheId(42);

      expect(ok).toBe(true);
      expect(stub.detail).toHaveBeenCalledWith(42);
      expect(stub.lastDetail.loadIfStale).toHaveBeenCalled();
      expect(state.sourceId()).toBe(42);
      expect(state.data().name).toBe('Combo Almuerzo');
      expect(state.dirty()).toBe(false);
    });
  });

  describe('mutations and dirty tracking', () => {
    it('updateData writes the field and flips dirty', () => {
      const state = setupTestBed();

      state.updateData({ name: 'Combo Actualizado' });

      expect(state.data().name).toBe('Combo Actualizado');
      expect(state.dirty()).toBe(true);
    });

    it('updateSelectedCategoryIds replaces the id list and flips dirty', () => {
      const state = setupTestBed();

      state.updateSelectedCategoryIds([3, 4]);

      expect(state.data().selectedCategoryIds).toEqual([3, 4]);
      expect(state.dirty()).toBe(true);
    });

    it('updateGroups clones group payloads and flips dirty', () => {
      const state = setupTestBed();
      const groupInput = [
        {
          id: null as number | null,
          categoryId: 7 as number | null,
          displayOrder: 0,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          productIds: [10, 11],
        },
      ];

      state.updateGroups(groupInput);
      groupInput[0].productIds.push(99);

      expect(state.data().groups.length).toBe(1);
      expect(state.data().groups[0].productIds).toEqual([10, 11]);
      expect(state.dirty()).toBe(true);
    });

    it('updateAdditions and updateQuestions mutate their respective collections', () => {
      const state = setupTestBed();

      state.updateAdditions([{ id: null, name: 'Tocineta', optionId: 5, extraPrice: 2, displayOrder: 0 }]);
      state.updateQuestions([{ id: null, question: 'Para llevar', required: false, displayOrder: 0 }]);
      state.updateSchedule([{ dayOfWeek: 'TUESDAY', startTime: '10:00', endTime: '14:00' }]);

      expect(state.data().additions.length).toBe(1);
      expect(state.data().additions[0].name).toBe('Tocineta');
      expect(state.data().questions[0].question).toBe('Para llevar');
      expect(state.data().schedule[0].dayOfWeek).toBe('TUESDAY');
      expect(state.dirty()).toBe(true);
    });
  });

  describe('step navigation', () => {
    it('setSteps seeds the step list and selects the first step by default', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'general', label: 'General' },
        { id: 'groups', label: 'Grupos' },
        { id: 'pricing', label: 'Precios' },
      ]);

      expect(state.steps().length).toBe(3);
      expect(state.currentStepId()).toBe('general');
      expect(state.currentStep()?.label).toBe('General');
      expect(state.currentStepIndex()).toBe(0);
      expect(state.canGoBack()).toBe(false);
      expect(state.canAdvance()).toBe(false);
    });

    it('markStepCompleted enables canAdvance while a later step remains', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);

      expect(state.canAdvance()).toBe(false);
      state.markStepCompleted('a');

      expect(state.isStepCompleted('a')).toBe(true);
      expect(state.completedSteps().has('a')).toBe(true);
      expect(state.canAdvance()).toBe(true);
      expect(state.canGoForward()).toBe(true);
    });

    it('canAdvance is false on the last step even when marked complete', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.setCurrentStep('b');
      state.markStepCompleted('b');

      expect(state.canAdvance()).toBe(false);
      expect(state.canGoForward()).toBe(false);
    });

    it('canGoBack is true on non-first steps', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.setCurrentStep('b');

      expect(state.canGoBack()).toBe(true);
    });

    it('setCurrentStep rejects unknown step ids', () => {
      const state = setupTestBed();
      state.setSteps([{ id: 'a', label: 'A' }]);

      const ok = state.setCurrentStep('nope');

      expect(ok).toBe(false);
      expect(state.currentStepId()).toBe('a');
    });

    it('goNext and goBack move between steps', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ]);
      state.markStepCompleted('a');

      expect(state.goNext()).toBe(true);
      expect(state.currentStepId()).toBe('b');
      expect(state.goBack()).toBe(true);
      expect(state.currentStepId()).toBe('a');
    });

    it('goNext returns false on the last step and goBack returns false on the first step', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.setCurrentStep('b');

      expect(state.goNext()).toBe(false);
      state.setCurrentStep('a');
      expect(state.goBack()).toBe(false);
    });

    it('markStepIncomplete removes the step from the completed set and disables canAdvance', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.markStepCompleted('a');
      expect(state.canAdvance()).toBe(true);

      state.markStepIncomplete('a');

      expect(state.completedSteps().has('a')).toBe(false);
      expect(state.canAdvance()).toBe(false);
    });

    it('setSteps preserves the current step if it still exists in the new list', () => {
      const state = setupTestBed();
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.setCurrentStep('b');

      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ]);

      expect(state.currentStepId()).toBe('b');
      expect(state.currentStepIndex()).toBe(1);
    });
  });

  describe('persistence', () => {
    it('persistDraft writes the current state with a versioned key and timestamp', () => {
      const state = setupTestBed();
      state.hydrateFromResponse(mockResponse);
      state.updateData({ name: 'Borrador persistido' });
      const before = Date.now();

      state.persistDraft();

      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        throw new Error('expected persisted draft');
      }
      const parsed = JSON.parse(raw) as {
        schemaVersion: number;
        sourceId: number | null;
        data: { name: string };
        updatedAt: number;
      };
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.sourceId).toBe(42);
      expect(parsed.data.name).toBe('Borrador persistido');
      expect(parsed.updatedAt).toBeGreaterThanOrEqual(before);
      expect(state.lastPersistedAt()).toBe(parsed.updatedAt);
    });

    it('restoreFromStorage returns no draft and no timestamp when nothing is persisted', () => {
      const state = setupTestBed();

      const result = state.restoreFromStorage();

      expect(result.draft).toBeNull();
      expect(result.savedAt).toBeNull();
      expect(result.conflict).toBe(false);
      expect(state.sourceId()).toBeNull();
      expect(state.dirty()).toBe(false);
    });

    it('restoreFromStorage hydrates from localStorage and returns the persisted timestamp', () => {
      const state = setupTestBed();
      state.hydrateFromResponse(mockResponse);
      state.updateData({ name: 'Borrador restaurado' });
      state.persistDraft();
      const expectedSavedAt = state.lastPersistedAt();

      TestBed.resetTestingModule();

      const fresh = setupTestBed();
      const result = fresh.restoreFromStorage();

      expect(result.conflict).toBe(false);
      expect(result.savedAt).toBe(expectedSavedAt);
      expect(result.draft?.sourceId).toBe(42);
      expect(result.draft?.data.name).toBe('Borrador restaurado');
      expect(fresh.sourceId()).toBe(42);
      expect(fresh.data().name).toBe('Borrador restaurado');
      expect(fresh.dirty()).toBe(true);
      expect(fresh.lastPersistedAt()).toBe(expectedSavedAt);
      expect(fresh.lastSavedAt()).toBeNull();
    });

    it('restoreFromStorage treats a schema version mismatch as a version conflict and clears storage', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 99,
          sourceId: 1,
          data: mockResponse,
          updatedAt: 123456,
        }),
      );
      const state = setupTestBed();

      const result = state.restoreFromStorage();

      expect(result.conflict).toBe(true);
      expect(result.draft).toBeNull();
      expect(result.savedAt).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(state.sourceId()).toBeNull();
    });

    it('restoreFromStorage discards malformed JSON safely without surfacing an error', () => {
      window.localStorage.setItem(STORAGE_KEY, 'not-json{');
      const state = setupTestBed();

      const result = state.restoreFromStorage();

      expect(result.conflict).toBe(false);
      expect(result.draft).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(state.sourceId()).toBeNull();
    });

    it('restoreFromStorage discards payload that does not match the expected shape', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ schemaVersion: 1, random: true }),
      );
      const state = setupTestBed();

      const result = state.restoreFromStorage();

      expect(result.conflict).toBe(false);
      expect(result.draft).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('discardDraft removes the persisted entry but leaves in-memory state intact', () => {
      const state = setupTestBed();
      state.hydrateFromResponse(mockResponse);
      state.updateData({ name: 'Para descartar' });
      state.persistDraft();
      expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      state.discardDraft();

      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
      expect(state.lastPersistedAt()).toBeNull();
      expect(state.data().name).toBe('Para descartar');
      expect(state.dirty()).toBe(true);
    });

    it('markSaved clears the persisted draft, resets dirty, and records lastSavedAt', () => {
      const state = setupTestBed();
      state.hydrateFromResponse(mockResponse);
      state.updateData({ name: 'Para guardar' });
      state.persistDraft();
      const before = Date.now();

      state.markSaved();

      expect(state.dirty()).toBe(false);
      const savedAt = state.lastSavedAt();
      expect(savedAt).not.toBeNull();
      if (savedAt === null) {
        throw new Error('expected lastSavedAt');
      }
      expect(savedAt).toBeGreaterThanOrEqual(before);
      expect(state.lastPersistedAt()).toBeNull();
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('reset', () => {
    it('clears the in-memory state, the persisted draft, and the step navigation state', () => {
      const state = setupTestBed();
      state.hydrateFromResponse(mockResponse);
      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.markStepCompleted('a');
      state.updateData({ name: 'Editado' });
      state.persistDraft();

      state.reset();

      expect(state.sourceId()).toBeNull();
      expect(state.data().name).toBe('');
      expect(state.dirty()).toBe(false);
      expect(state.lastSavedAt()).toBeNull();
      expect(state.lastPersistedAt()).toBeNull();
      expect(state.steps()).toEqual([]);
      expect(state.currentStepId()).toBeNull();
      expect(state.completedSteps().size).toBe(0);
      expect(state.canAdvance()).toBe(false);
      expect(state.canGoBack()).toBe(false);
      expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('signal reactivity', () => {
    it('exposes signals whose computed values reflect subsequent mutations', () => {
      const state = setupTestBed();

      expect(state.dirty()).toBe(false);
      expect(state.canAdvance()).toBe(false);
      expect(state.completedSteps().size).toBe(0);

      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.markStepCompleted('a');
      expect(state.canAdvance()).toBe(true);
      expect(state.completedSteps().has('a')).toBe(true);

      state.updateData({ name: 'Cambio' });
      expect(state.dirty()).toBe(true);
      expect(state.data().name).toBe('Cambio');

      state.updateData({ name: 'Otro cambio' });
      expect(state.data().name).toBe('Otro cambio');
      expect(state.dirty()).toBe(true);

      state.hydrateFromResponse(null);
      expect(state.dirty()).toBe(false);
      expect(state.data().name).toBe('');
      expect(state.sourceId()).toBeNull();

      state.setCurrentStep('b');
      expect(state.currentStepId()).toBe('b');
      expect(state.currentStepIndex()).toBe(1);
      expect(state.canGoBack()).toBe(true);
      expect(state.canAdvance()).toBe(false);
    });

    it('an effect subscriber observes the latest canAdvance value across mutation batches', async () => {
      const state = setupTestBed();
      const seen: boolean[] = [];

      TestBed.runInInjectionContext(() => {
        effect(() => {
          seen.push(state.canAdvance());
        });
      });

      state.setSteps([
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ]);
      state.markStepCompleted('a');

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(seen.length).toBeGreaterThan(0);
      expect(seen[seen.length - 1]).toBe(true);
    });
  });
});