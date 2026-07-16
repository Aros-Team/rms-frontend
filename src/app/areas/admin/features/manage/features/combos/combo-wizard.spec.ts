import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  ɵresolveComponentResources as resolveComponentResources,
  Component,
  type Type,
  type WritableSignal,
} from '@angular/core';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import { ComboWizardState } from '@app/core/services/combos/combo-wizard-state';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import type { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';

import comboWizardHtml from './combo-wizard.html?raw';
import { ComboWizard } from './combo-wizard';

interface CategoryStub {
  id: number;
  name: string;
}

interface ReferenceStub {
  categories: WritableSignal<CategoryStub[]>;
  categoryName: (id: number) => string | undefined;
}

function buildReferenceStub(initial: CategoryStub[] = []): ReferenceStub {
  const categories: WritableSignal<CategoryStub[]> = signal<CategoryStub[]>(initial);
  return {
    categories,
    categoryName: (id: number) => categories().find((c) => c.id === id)?.name,
  };
}

interface ResourceCacheStub<T> {
  data: WritableSignal<T | null>;
  loadIfStale: () => void;
}

interface SpecialSelectionsCacheStub {
  detail: (id: number) => ResourceCacheStub<SpecialSelectionResponse>;
}

function specialSelectionsCacheStub(): SpecialSelectionsCacheStub {
  return {
    detail: () => ({
      data: signal<SpecialSelectionResponse | null>(null),
      loadIfStale: (): void => undefined,
    }),
  };
}

interface WizardEnv {
  fixture: ComponentFixture<ComboWizard>;
  wizard: ComboWizard;
  state: ComboWizardState;
  reference: ReferenceStub;
  setCategories(next: CategoryStub[]): void;
}

async function setupWizardTestBed(initialCategories: CategoryStub[] = []): Promise<WizardEnv> {
  const reference = buildReferenceStub(initialCategories);
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ComboWizard],
    providers: [
      ComboWizardState,
      provideRouter([]),
      provideHttpClient(),
      MessageService,
      { provide: ComboReferenceCache, useValue: reference },
      { provide: SpecialSelectionsCacheService, useValue: specialSelectionsCacheStub() },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ComboWizard);
  fixture.detectChanges();
  const wizard: ComboWizard = fixture.componentInstance;
  const state: ComboWizardState = TestBed.inject(ComboWizardState);
  return {
    fixture,
    wizard,
    state,
    reference,
    setCategories(next: CategoryStub[]): void {
      reference.categories.set(next);
    },
  };
}

interface HostEnv<T> {
  fixture: ComponentFixture<T>;
}

async function setupHostTestBed<T extends object>(host: Type<T>): Promise<HostEnv<T>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [host, ComboWizard],
    providers: [
      ComboWizardState,
      provideRouter([]),
      provideHttpClient(),
      MessageService,
      { provide: ComboReferenceCache, useValue: buildReferenceStub() },
      { provide: SpecialSelectionsCacheService, useValue: specialSelectionsCacheStub() },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  return { fixture };
}

@Component({
  selector: 'app-host-with-general',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="general" data-testid="custom-general">Contenido General Personalizado</div>
    </app-combo-wizard>
  `,
})
class HostWithGeneral {
  readonly marker = true as const;
}

@Component({
  selector: 'app-host-with-category',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="category" data-testid="custom-category">Productos</div>
    </app-combo-wizard>
  `,
})
class HostWithCategory {
  readonly marker = true as const;
}

@Component({
  selector: 'app-host-with-questions',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="questions" data-testid="custom-questions">Preguntas Personalizadas</div>
    </app-combo-wizard>
  `,
})
class HostWithQuestions {
  readonly marker = true as const;
}

@Component({
  selector: 'app-host-with-pricing',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="pricing" data-testid="custom-pricing">Precio Final</div>
    </app-combo-wizard>
  `,
})
class HostWithPricing {
  readonly marker = true as const;
}

@Component({
  selector: 'app-host-with-mixed-slots',
  imports: [ComboWizard],
  template: `
    <app-combo-wizard>
      <div comboWizardStep="general" data-testid="custom-general">General Slot</div>
      <div comboWizardStep="category" data-testid="custom-category">Category Slot</div>
      <div comboWizardStep="questions" data-testid="custom-questions">Questions Slot</div>
      <div comboWizardStep="pricing" data-testid="custom-pricing">Pricing Slot</div>
    </app-combo-wizard>
  `,
})
class HostWithMixedSlots {
  readonly marker = true as const;
}

function getFooterButtons(root: HTMLElement): { back: HTMLButtonElement; next: HTMLButtonElement } {
  const buttons = root.querySelectorAll('p-button button');
  const back = buttons.item(0) as HTMLButtonElement | null;
  const next = buttons.item(buttons.length - 1) as HTMLButtonElement | null;
  if (!back || !next) {
    throw new Error('footer buttons not found');
  }
  return { back, next };
}

function clickButton(button: HTMLButtonElement): void {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('ComboWizard shell', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('combo-wizard.html')) {
        return Promise.resolve(comboWizardHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('step list rendering', () => {
    it('renders the four base steps in order when no categories are chosen', async () => {
      const env = await setupWizardTestBed();
      const ids = env.wizard.stepView().map((step) => step.id);
      const labels = env.wizard.stepView().map((step) => step.label);

      expect(ids).toEqual(['general', 'questions', 'pricing']);
      expect(labels).toEqual(['Información general', 'Preguntas', 'Precio final']);
    });

    it('renders one step per selected category using the resolved name when available', async () => {
      const env = await setupWizardTestBed([
        { id: 7, name: 'Bebidas' },
        { id: 9, name: 'Postres' },
      ]);
      env.state.updateSelectedCategoryIds([7, 9]);
      env.fixture.detectChanges();

      const ids = env.wizard.stepView().map((step) => step.id);
      const labels = env.wizard.stepView().map((step) => step.label);

      expect(ids).toEqual(['general', 'category:7', 'category:9', 'questions', 'pricing']);
      expect(labels).toEqual([
        'Información general',
        'Bebidas',
        'Postres',
        'Preguntas',
        'Precio final',
      ]);
    });

    it('falls back to "Categoría #<id>" when the reference cache has no name for the category', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([42]);
      env.fixture.detectChanges();

      const labels = env.wizard.stepView().map((step) => step.label);

      expect(labels).toEqual([
        'Información general',
        'Categoría #42',
        'Preguntas',
        'Precio final',
      ]);
    });

    it('reflects category name updates from the reference cache reactively', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([11]);
      env.fixture.detectChanges();

      const before = env.wizard.stepView()[1]?.label;

      env.setCategories([{ id: 11, name: 'Entradas' }]);
      env.fixture.detectChanges();

      const after = env.wizard.stepView()[1]?.label;

      expect(before).toBe('Categoría #11');
      expect(after).toBe('Entradas');
    });
  });

  describe('marker states', () => {
    it('marks the first step as active and the rest as inactive initially', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([1, 2]);
      env.fixture.detectChanges();

      const markers = env.wizard.stepView().map((step) => step.marker);
      const view = env.wizard.stepView();

      expect(markers).toEqual(['active', 'inactive', 'inactive', 'inactive', 'inactive']);
      expect(view[0]?.isCurrent).toBe(true);
      expect(view.slice(1).every((step) => !step.isCurrent)).toBe(true);
    });

    it('marks completed steps as completed and the new current step as active', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([3]);
      env.fixture.detectChanges();
      env.state.markStepCompleted('general');
      env.state.setCurrentStep('category:3');

      const markers = env.wizard.stepView().map((step) => step.marker);

      expect(markers[0]).toBe('completed');
      expect(markers[1]).toBe('active');
      expect(markers.slice(2).every((m) => m === 'inactive')).toBe(true);
    });

    it('exposes the correct slot key per step type', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([5]);
      env.fixture.detectChanges();

      const slotKeys = env.wizard.stepView().map((step) => step.slotKey);

      expect(slotKeys).toEqual(['general', 'category', 'questions', 'pricing']);
    });
  });

  describe('navigation guards', () => {
    it('disables the "Siguiente" button when the current step is not completed', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([1, 2]);
      env.fixture.detectChanges();

      const root = env.fixture.nativeElement as HTMLElement;
      const { next: nextButton } = getFooterButtons(root);

      expect(env.wizard.canAdvance()).toBe(false);
      expect(nextButton.disabled).toBe(true);
    });

    it('advances when the "Siguiente" button is clicked after the current step is marked complete', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([1]);
      env.state.markStepCompleted('general');
      env.fixture.detectChanges();

      const root = env.fixture.nativeElement as HTMLElement;
      const { next: nextButton } = getFooterButtons(root);

      expect(env.wizard.canAdvance()).toBe(true);
      expect(nextButton.disabled).toBe(false);
      clickButton(nextButton);
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('category:1');
    });

    it('clicking the disabled "Siguiente" button is a no-op when canAdvance is false', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([1]);
      env.fixture.detectChanges();

      const root = env.fixture.nativeElement as HTMLElement;
      const { next: nextButton } = getFooterButtons(root);

      expect(nextButton.disabled).toBe(true);
      clickButton(nextButton);
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('general');
    });

    it('disables the "Atrás" button on the first step and enables it after advancing', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([1]);
      env.state.markStepCompleted('general');
      env.fixture.detectChanges();

      const rootBefore = env.fixture.nativeElement as HTMLElement;
      const before = getFooterButtons(rootBefore);

      expect(before.back.disabled).toBe(true);

      clickButton(before.next);
      env.fixture.detectChanges();

      expect(env.state.currentStepId()).toBe('category:1');
      expect(env.wizard.canGoBack()).toBe(true);

      const rootAfter = env.fixture.nativeElement as HTMLElement;
      const after = getFooterButtons(rootAfter);
      expect(after.back.disabled).toBe(false);

      clickButton(after.back);
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('general');
      expect(env.wizard.canGoBack()).toBe(false);
    });

    it('blocks forward navigation on the last step even if it is marked complete', async () => {
      const env = await setupWizardTestBed();
      env.state.updateSelectedCategoryIds([]);
      env.state.markStepCompleted('general');
      env.state.setCurrentStep('pricing');
      env.state.markStepCompleted('pricing');
      env.fixture.detectChanges();

      const root = env.fixture.nativeElement as HTMLElement;
      const { next: nextButton } = getFooterButtons(root);

      expect(env.wizard.canAdvance()).toBe(false);
      expect(nextButton.disabled).toBe(true);
      clickButton(nextButton);
      env.fixture.detectChanges();
      expect(env.state.currentStepId()).toBe('pricing');
    });
  });

  describe('slot structure', () => {
    it('renders a placeholder card for the active step when no content is projected', async () => {
      const env = await setupWizardTestBed();
      const activeId = env.wizard.stepView().find((step) => step.isCurrent)?.id ?? 'general';

      const root = env.fixture.nativeElement as HTMLElement;
      const pane = root.querySelector(`[data-step-pane="${activeId}"]`);
      expect(pane).toBeTruthy();

      const placeholder = pane?.querySelector('[data-testid="step-placeholder"]');
      expect(placeholder).toBeTruthy();
    });

    it('hides the placeholder when the active slot has projected content', async () => {
      const host = await setupHostTestBed<HostWithGeneral>(HostWithGeneral);
      const root = host.fixture.nativeElement as HTMLElement;

      const pane = root.querySelector('[data-step-pane="general"]');
      expect(pane).toBeTruthy();

      const placeholder = pane?.querySelector('[data-testid="step-placeholder"]');
      expect(placeholder).toBeNull();
    });

    it('projects custom content into the active-step pane via the [comboWizardStep=...] selector', async () => {
      const host = await setupHostTestBed<HostWithGeneral>(HostWithGeneral);
      const root = host.fixture.nativeElement as HTMLElement;

      const projected = root.querySelector('[data-testid="custom-general"]');
      expect(projected).toBeTruthy();
      const text = (projected?.textContent ?? '').trim();
      expect(text).toBe('Contenido General Personalizado');

      const pane = projected?.closest('[data-step-pane]');
      expect(pane?.getAttribute('data-step-pane')).toBe('general');
    });

    it('routes the category slot projection into the active per-category step', async () => {
      const host = await setupHostTestBed<HostWithCategory>(HostWithCategory);
      const state = TestBed.inject(ComboWizardState);
      state.updateSelectedCategoryIds([99]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:99');
      host.fixture.detectChanges();

      const root = host.fixture.nativeElement as HTMLElement;
      const projected = root.querySelector('[data-testid="custom-category"]');
      expect(projected).toBeTruthy();

      const parent = projected?.parentElement;
      expect(parent?.getAttribute('data-step-pane')).toBe('category:99');
    });

    it('projects questions slot content into the active questions step', async () => {
      const host = await setupHostTestBed<HostWithQuestions>(HostWithQuestions);
      const state = TestBed.inject(ComboWizardState);
      state.markStepCompleted('general');
      state.setCurrentStep('questions');
      host.fixture.detectChanges();

      const root = host.fixture.nativeElement as HTMLElement;
      const projected = root.querySelector('[data-testid="custom-questions"]');
      expect(projected).toBeTruthy();
      expect((projected?.textContent ?? '').trim()).toBe('Preguntas Personalizadas');

      const pane = projected?.closest('[data-step-pane]');
      expect(pane?.getAttribute('data-step-pane')).toBe('questions');

      const placeholder = pane?.querySelector('[data-testid="step-placeholder"]');
      expect(placeholder).toBeNull();
    });

    it('projects pricing slot content into the active pricing step', async () => {
      const host = await setupHostTestBed<HostWithPricing>(HostWithPricing);
      const state = TestBed.inject(ComboWizardState);
      state.markStepCompleted('general');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();

      const root = host.fixture.nativeElement as HTMLElement;
      const projected = root.querySelector('[data-testid="custom-pricing"]');
      expect(projected).toBeTruthy();
      expect((projected?.textContent ?? '').trim()).toBe('Precio Final');

      const pane = projected?.closest('[data-step-pane]');
      expect(pane?.getAttribute('data-step-pane')).toBe('pricing');

      const placeholder = pane?.querySelector('[data-testid="step-placeholder"]');
      expect(placeholder).toBeNull();
    });

    it('isolates content: only the active slot renders even when all four slots are projected', async () => {
      const host = await setupHostTestBed<HostWithMixedSlots>(HostWithMixedSlots);
      const state = TestBed.inject(ComboWizardState);
      const root = host.fixture.nativeElement as HTMLElement;

      const assertOnlyActiveVisible = (activeId: string, activeTestId: string): void => {
        const visiblePanes = root.querySelectorAll('[data-step-pane]');
        expect(visiblePanes.length).toBe(1);
        expect(visiblePanes.item(0).getAttribute('data-step-pane')).toBe(activeId);

        const visibleContent = root.querySelectorAll('[data-testid^="custom-"]');
        const visibleTestIds = Array.from(visibleContent).map((node) => node.getAttribute('data-testid'));
        expect(visibleTestIds).toEqual([activeTestId]);

        const inactiveTestIds = ['custom-general', 'custom-category', 'custom-questions', 'custom-pricing']
          .filter((id) => id !== activeTestId);
        for (const inactiveId of inactiveTestIds) {
          expect(root.querySelector(`[data-testid="${inactiveId}"]`)).toBeNull();
        }

        const placeholder = visiblePanes.item(0).querySelector('[data-testid="step-placeholder"]');
        expect(placeholder).toBeNull();
      };

      assertOnlyActiveVisible('general', 'custom-general');

      state.markStepCompleted('general');
      state.updateSelectedCategoryIds([42]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:42');
      host.fixture.detectChanges();
      assertOnlyActiveVisible('category:42', 'custom-category');

      state.markStepCompleted('category:42');
      state.setCurrentStep('questions');
      host.fixture.detectChanges();
      assertOnlyActiveVisible('questions', 'custom-questions');

      state.markStepCompleted('questions');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();
      assertOnlyActiveVisible('pricing', 'custom-pricing');
    });
  });

  describe('content child detection', () => {
    it('detects general slot content via hasSlotContent', async () => {
      const host = await setupHostTestBed<HostWithGeneral>(HostWithGeneral);
      const wizardDebug = host.fixture.debugElement.query(By.directive(ComboWizard));
      const wizard = wizardDebug.componentInstance as ComboWizard;

      expect(wizard.hasSlotContent('general')).toBe(true);
      expect(wizard.hasSlotContent('category')).toBe(false);
      expect(wizard.hasSlotContent('questions')).toBe(false);
      expect(wizard.hasSlotContent('pricing')).toBe(false);
    });

    it('detects category slot content via hasSlotContent when category step is active', async () => {
      const host = await setupHostTestBed<HostWithCategory>(HostWithCategory);
      const state = TestBed.inject(ComboWizardState);
      state.updateSelectedCategoryIds([99]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:99');
      host.fixture.detectChanges();
      const wizardDebug = host.fixture.debugElement.query(By.directive(ComboWizard));
      const wizard = wizardDebug.componentInstance as ComboWizard;

      expect(wizard.hasSlotContent('category')).toBe(true);
    });

    it('detects questions slot content via hasSlotContent when questions step is active', async () => {
      const host = await setupHostTestBed<HostWithQuestions>(HostWithQuestions);
      const state = TestBed.inject(ComboWizardState);
      state.markStepCompleted('general');
      state.setCurrentStep('questions');
      host.fixture.detectChanges();
      const wizardDebug = host.fixture.debugElement.query(By.directive(ComboWizard));
      const wizard = wizardDebug.componentInstance as ComboWizard;

      expect(wizard.hasSlotContent('questions')).toBe(true);
    });

    it('detects pricing slot content via hasSlotContent when pricing step is active', async () => {
      const host = await setupHostTestBed<HostWithPricing>(HostWithPricing);
      const state = TestBed.inject(ComboWizardState);
      state.markStepCompleted('general');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();
      const wizardDebug = host.fixture.debugElement.query(By.directive(ComboWizard));
      const wizard = wizardDebug.componentInstance as ComboWizard;

      expect(wizard.hasSlotContent('pricing')).toBe(true);
    });

    it('detects each slot content only when its step is active', async () => {
      const host = await setupHostTestBed<HostWithMixedSlots>(HostWithMixedSlots);
      const state = TestBed.inject(ComboWizardState);
      const wizardDebug = host.fixture.debugElement.query(By.directive(ComboWizard));
      const wizard = wizardDebug.componentInstance as ComboWizard;

      expect(wizard.hasSlotContent('general')).toBe(true);
      expect(wizard.hasSlotContent('category')).toBe(false);
      expect(wizard.hasSlotContent('questions')).toBe(false);
      expect(wizard.hasSlotContent('pricing')).toBe(false);

      state.updateSelectedCategoryIds([42]);
      host.fixture.detectChanges();
      state.setCurrentStep('category:42');
      host.fixture.detectChanges();
      expect(wizard.hasSlotContent('category')).toBe(true);

      state.markStepCompleted('category:42');
      state.setCurrentStep('questions');
      host.fixture.detectChanges();
      expect(wizard.hasSlotContent('questions')).toBe(true);

      state.markStepCompleted('questions');
      state.setCurrentStep('pricing');
      host.fixture.detectChanges();
      expect(wizard.hasSlotContent('pricing')).toBe(true);
    });

    it('returns false for hasSlotContent when no content is projected', async () => {
      const env = await setupWizardTestBed();
      expect(env.wizard.hasSlotContent('general')).toBe(false);
      expect(env.wizard.hasSlotContent('category')).toBe(false);
      expect(env.wizard.hasSlotContent('questions')).toBe(false);
      expect(env.wizard.hasSlotContent('pricing')).toBe(false);
    });
  });

  describe('Spanish UI text', () => {
    it('renders the Spanish title and footer button labels', async () => {
      const env = await setupWizardTestBed();
      const root = env.fixture.nativeElement as HTMLElement;
      const text = root.textContent;

      expect(text).toContain('Asistente de combo');

      const buttons = root.querySelectorAll('p-button button');
      const labels: string[] = [];
      buttons.forEach((btn) => {
        labels.push(btn.textContent.trim());
      });

      expect(labels).toContain('Atrás');
      expect(labels).toContain('Siguiente');
    });

    it('shows the "Editar combo" title when a sourceId is hydrated', async () => {
      const env = await setupWizardTestBed();
      env.state.hydrateFromResponse({
        id: 5,
        name: 'Combo demo',
        description: '',
        basePrice: 0,
        active: true,
        preparationAreaId: 1,
        selectionType: 'SPECIAL_SELECTION',
        baseRecipeEnabled: false,
        schedulingRequired: false,
        groups: [],
        additions: [],
        questions: [],
        schedule: [],
      });
      env.fixture.detectChanges();

      expect(env.wizard.pageTitle()).toBe('Editar combo');
      expect(env.wizard.sourceId()).toBe(5);
    });
  });
});