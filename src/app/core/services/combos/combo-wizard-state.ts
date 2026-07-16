import {
  Injectable,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import type { DayOfWeek } from '@app/shared/models/dto/special-selections/schedule-entry';

export type WizardStepId = string;

export interface WizardStep {
  id: WizardStepId;
  label: string;
}

export interface WizardScheduleEntryDraft {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface WizardGroupDraft {
  id: number | null;
  categoryId: number | null;
  displayOrder: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  productIds: number[];
}

export interface WizardAdditionDraft {
  id: number | null;
  name: string;
  optionId: number | null;
  extraPrice: number;
  displayOrder: number;
}

export interface WizardQuestionDraft {
  id: number | null;
  question: string;
  required: boolean;
  displayOrder: number;
}

export interface WizardFormData {
  name: string;
  description: string;
  basePrice: number | null;
  areaId: number | null;
  active: boolean;
  baseRecipeEnabled: boolean;
  schedulingRequired: boolean;
  selectedCategoryIds: number[];
  groups: WizardGroupDraft[];
  additions: WizardAdditionDraft[];
  questions: WizardQuestionDraft[];
  schedule: WizardScheduleEntryDraft[];
}

export interface ComboWizardDraft {
  sourceId: number | null;
  data: WizardFormData;
}

export interface RestoreResult {
  draft: ComboWizardDraft | null;
  savedAt: number | null;
  conflict: boolean;
}

export const COMBO_WIZARD_DRAFT_STORAGE_KEY = 'rms:combo-wizard-draft:v1';
const COMBO_WIZARD_DRAFT_SCHEMA_VERSION = 1;

interface PersistedWizardDraft {
  schemaVersion: number;
  sourceId: number | null;
  data: WizardFormData;
  updatedAt: number;
}

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

function emptyDraft(): ComboWizardDraft {
  return { sourceId: null, data: emptyFormData() };
}

function responseToFormData(response: SpecialSelectionResponse): WizardFormData {
  const selectedCategoryIds: number[] = [];
  for (const group of response.groups) {
    if (group.categoryId !== null && !selectedCategoryIds.includes(group.categoryId)) {
      selectedCategoryIds.push(group.categoryId);
    }
  }
  return {
    name: response.name,
    description: response.description,
    basePrice: response.basePrice,
    areaId: response.preparationAreaId,
    active: response.active,
    baseRecipeEnabled: response.baseRecipeEnabled,
    schedulingRequired: response.schedulingRequired,
    selectedCategoryIds,
    groups: response.groups.map((group) => ({
      id: group.id,
      categoryId: group.categoryId,
      displayOrder: group.displayOrder,
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      productIds: [...group.productIds],
    })),
    additions: response.additions.map((addition) => ({
      id: addition.id,
      name: addition.name,
      optionId: addition.optionId,
      extraPrice: addition.extraPrice,
      displayOrder: addition.displayOrder,
    })),
    questions: response.questions.map((question) => ({
      id: question.id,
      question: question.question,
      required: question.required,
      displayOrder: question.displayOrder,
    })),
    schedule: response.schedule.map((entry) => ({
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
    })),
  };
}

function cloneFormData(data: WizardFormData): WizardFormData {
  return {
    ...data,
    selectedCategoryIds: [...data.selectedCategoryIds],
    groups: data.groups.map((group) => ({ ...group, productIds: [...group.productIds] })),
    additions: data.additions.map((addition) => ({ ...addition })),
    questions: data.questions.map((question) => ({ ...question })),
    schedule: data.schedule.map((entry) => ({ ...entry })),
  };
}

function isPersistedDraft(value: unknown): value is PersistedWizardDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['schemaVersion'] !== 'number') {
    return false;
  }
  if (!('sourceId' in candidate)) {
    return false;
  }
  if (typeof candidate['updatedAt'] !== 'number') {
    return false;
  }
  if (typeof candidate['data'] !== 'object' || candidate['data'] === null) {
    return false;
  }
  return true;
}

@Injectable({ providedIn: 'root' })
export class ComboWizardState {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cache = inject(SpecialSelectionsCacheService);

  private readonly draftState: WritableSignal<ComboWizardDraft>;
  private readonly dirtyFlag: WritableSignal<boolean>;
  private readonly lastSavedAtState: WritableSignal<number | null>;
  private readonly lastPersistedAtState: WritableSignal<number | null>;
  private readonly stepsState: WritableSignal<readonly WizardStep[]>;
  private readonly currentStepIdState: WritableSignal<WizardStepId | null>;
  private readonly completedStepsState: WritableSignal<ReadonlySet<WizardStepId>>;

  readonly draft: Signal<ComboWizardDraft>;
  readonly data: Signal<WizardFormData>;
  readonly sourceId: Signal<number | null>;
  readonly dirty: Signal<boolean>;
  readonly lastSavedAt: Signal<number | null>;
  readonly lastPersistedAt: Signal<number | null>;
  readonly steps: Signal<readonly WizardStep[]>;
  readonly currentStepId: Signal<WizardStepId | null>;
  readonly currentStep: Signal<WizardStep | null>;
  readonly currentStepIndex: Signal<number>;
  readonly completedSteps: Signal<ReadonlySet<WizardStepId>>;
  readonly canAdvance: Signal<boolean>;
  readonly canGoBack: Signal<boolean>;
  readonly canGoForward: Signal<boolean>;

  constructor() {
    this.draftState = signal<ComboWizardDraft>(emptyDraft());
    this.dirtyFlag = signal<boolean>(false);
    this.lastSavedAtState = signal<number | null>(null);
    this.lastPersistedAtState = signal<number | null>(null);
    this.stepsState = signal<readonly WizardStep[]>([]);
    this.currentStepIdState = signal<WizardStepId | null>(null);
    this.completedStepsState = signal<ReadonlySet<WizardStepId>>(new Set());

    this.draft = this.draftState.asReadonly();
    this.data = computed<WizardFormData>(() => this.draftState().data);
    this.sourceId = computed<number | null>(() => this.draftState().sourceId);
    this.dirty = this.dirtyFlag.asReadonly();
    this.lastSavedAt = this.lastSavedAtState.asReadonly();
    this.lastPersistedAt = this.lastPersistedAtState.asReadonly();
    this.steps = this.stepsState.asReadonly();
    this.currentStepId = this.currentStepIdState.asReadonly();
    this.completedSteps = this.completedStepsState.asReadonly();

    this.currentStep = computed<WizardStep | null>(() => {
      const id = this.currentStepIdState();
      if (id === null) {
        return null;
      }
      return this.stepsState().find((step) => step.id === id) ?? null;
    });

    this.currentStepIndex = computed<number>(() => {
      const id = this.currentStepIdState();
      if (id === null) {
        return -1;
      }
      return this.stepsState().findIndex((step) => step.id === id);
    });

    this.canAdvance = computed<boolean>(() => {
      const id = this.currentStepIdState();
      if (id === null) {
        return false;
      }
      const steps = this.stepsState();
      const index = steps.findIndex((step) => step.id === id);
      if (index === -1 || index >= steps.length - 1) {
        return false;
      }
      return this.completedStepsState().has(id);
    });

    this.canGoBack = computed<boolean>(() => this.currentStepIndex() > 0);
    this.canGoForward = computed<boolean>(() => this.canAdvance());
  }

  hydrateFromResponse(response: SpecialSelectionResponse | null): void {
    if (response === null) {
      this.draftState.set(emptyDraft());
      this.lastSavedAtState.set(null);
    } else {
      this.draftState.set({
        sourceId: response.id,
        data: responseToFormData(response),
      });
      this.lastSavedAtState.set(Date.now());
    }
    this.dirtyFlag.set(false);
    this.lastPersistedAtState.set(null);
    this.completedStepsState.set(new Set());
    this.removePersistedDraft();
  }

  hydrateFromCacheId(id: number): boolean {
    const detailCache = this.cache.detail(id);
    detailCache.loadIfStale();
    const response = detailCache.data();
    if (response === null) {
      return false;
    }
    this.hydrateFromResponse(response);
    return true;
  }

  reset(): void {
    this.draftState.set(emptyDraft());
    this.dirtyFlag.set(false);
    this.lastSavedAtState.set(null);
    this.lastPersistedAtState.set(null);
    this.stepsState.set([]);
    this.currentStepIdState.set(null);
    this.completedStepsState.set(new Set());
    this.removePersistedDraft();
  }

  updateData(partial: Partial<Omit<WizardFormData, 'groups' | 'additions' | 'questions' | 'schedule' | 'selectedCategoryIds'>>): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: { ...current.data, ...partial },
    }));
    this.dirtyFlag.set(true);
  }

  updateSelectedCategoryIds(categoryIds: readonly number[]): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: { ...current.data, selectedCategoryIds: [...categoryIds] },
    }));
    this.dirtyFlag.set(true);
  }

  updateGroups(groups: readonly WizardGroupDraft[]): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: {
        ...current.data,
        groups: groups.map((group) => ({ ...group, productIds: [...group.productIds] })),
      },
    }));
    this.dirtyFlag.set(true);
  }

  updateAdditions(additions: readonly WizardAdditionDraft[]): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: { ...current.data, additions: additions.map((addition) => ({ ...addition })) },
    }));
    this.dirtyFlag.set(true);
  }

  updateQuestions(questions: readonly WizardQuestionDraft[]): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: { ...current.data, questions: questions.map((question) => ({ ...question })) },
    }));
    this.dirtyFlag.set(true);
  }

  updateSchedule(schedule: readonly WizardScheduleEntryDraft[]): void {
    this.draftState.update((current) => ({
      sourceId: current.sourceId,
      data: { ...current.data, schedule: schedule.map((entry) => ({ ...entry })) },
    }));
    this.dirtyFlag.set(true);
  }

  setSteps(steps: readonly WizardStep[]): void {
    const next = [...steps];
    this.stepsState.set(next);
    const currentId = this.currentStepIdState();
    if (currentId === null || !next.some((step) => step.id === currentId)) {
      this.currentStepIdState.set(next.length > 0 ? next[0].id : null);
    }
  }

  setCurrentStep(id: WizardStepId): boolean {
    if (!this.stepsState().some((step) => step.id === id)) {
      return false;
    }
    this.currentStepIdState.set(id);
    return true;
  }

  goNext(): boolean {
    const index = this.currentStepIndex();
    const steps = this.stepsState();
    if (index === -1 || index >= steps.length - 1) {
      return false;
    }
    this.currentStepIdState.set(steps[index + 1].id);
    return true;
  }

  goBack(): boolean {
    const index = this.currentStepIndex();
    if (index <= 0) {
      return false;
    }
    const steps = this.stepsState();
    this.currentStepIdState.set(steps[index - 1].id);
    return true;
  }

  markStepCompleted(id: WizardStepId): void {
    if (!this.stepsState().some((step) => step.id === id)) {
      return;
    }
    const next = new Set(this.completedStepsState());
    next.add(id);
    this.completedStepsState.set(next);
  }

  markStepIncomplete(id: WizardStepId): void {
    if (!this.completedStepsState().has(id)) {
      return;
    }
    const next = new Set(this.completedStepsState());
    next.delete(id);
    this.completedStepsState.set(next);
  }

  isStepCompleted(id: WizardStepId): boolean {
    return this.completedStepsState().has(id);
  }

  persistDraft(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const now = Date.now();
    const payload: PersistedWizardDraft = {
      schemaVersion: COMBO_WIZARD_DRAFT_SCHEMA_VERSION,
      sourceId: this.draftState().sourceId,
      data: cloneFormData(this.draftState().data),
      updatedAt: now,
    };
    try {
      window.localStorage.setItem(
        COMBO_WIZARD_DRAFT_STORAGE_KEY,
        JSON.stringify(payload),
      );
      this.lastPersistedAtState.set(now);
    } catch {
      this.lastPersistedAtState.set(null);
    }
  }

  restoreFromStorage(): RestoreResult {
    if (!isPlatformBrowser(this.platformId)) {
      return { draft: null, savedAt: null, conflict: false };
    }
    const raw = window.localStorage.getItem(COMBO_WIZARD_DRAFT_STORAGE_KEY);
    if (raw === null) {
      return { draft: null, savedAt: null, conflict: false };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.localStorage.removeItem(COMBO_WIZARD_DRAFT_STORAGE_KEY);
      return { draft: null, savedAt: null, conflict: false };
    }
    if (!isPersistedDraft(parsed)) {
      window.localStorage.removeItem(COMBO_WIZARD_DRAFT_STORAGE_KEY);
      return { draft: null, savedAt: null, conflict: false };
    }
    if (parsed.schemaVersion !== COMBO_WIZARD_DRAFT_SCHEMA_VERSION) {
      window.localStorage.removeItem(COMBO_WIZARD_DRAFT_STORAGE_KEY);
      return { draft: null, savedAt: null, conflict: true };
    }
    this.draftState.set({
      sourceId: parsed.sourceId,
      data: cloneFormData(parsed.data),
    });
    this.dirtyFlag.set(true);
    this.lastSavedAtState.set(null);
    this.lastPersistedAtState.set(parsed.updatedAt);
    return {
      draft: {
        sourceId: parsed.sourceId,
        data: cloneFormData(parsed.data),
      },
      savedAt: parsed.updatedAt,
      conflict: false,
    };
  }

  discardDraft(): void {
    this.removePersistedDraft();
    this.lastPersistedAtState.set(null);
  }

  markSaved(): void {
    this.dirtyFlag.set(false);
    this.lastSavedAtState.set(Date.now());
    this.lastPersistedAtState.set(null);
    this.removePersistedDraft();
  }

  private removePersistedDraft(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    try {
      window.localStorage.removeItem(COMBO_WIZARD_DRAFT_STORAGE_KEY);
    } catch {
      void 0;
    }
  }
}