import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';

import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import {
  ComboWizardState,
  type WizardGroupDraft,
} from '@app/core/services/combos/combo-wizard-state';
import type { DayOfWeek } from '@app/shared/models/dto/special-selections/schedule-entry';

const STEP_GENERAL_ID = 'general';

const ALL_DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Lunes' },
  { value: 'TUESDAY', label: 'Martes' },
  { value: 'WEDNESDAY', label: 'Miércoles' },
  { value: 'THURSDAY', label: 'Jueves' },
  { value: 'FRIDAY', label: 'Viernes' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
];

interface ScheduleBlock {
  id: number;
  dayOfWeek: DayOfWeek[];
  startTime: Date;
  endTime: Date;
}

@Component({
  selector: 'app-general-step[comboWizardStep=general]',
  imports: [
    FormsModule,
    ButtonModule,
    CheckboxModule,
    ChipModule,
    DatePickerModule,
    InputTextModule,
    SkeletonModule,
    TextareaModule,
  ],
  templateUrl: './general-step.html',
  styleUrl: './general-step.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeneralStep {
  private readonly wizard = inject(ComboWizardState);
  private readonly reference = inject(ComboReferenceCache);

  readonly ref = this.reference;
  readonly wizardData = this.wizard.data;

  readonly isLoading = computed(() => this.reference.isLoading());

  readonly allDays = ALL_DAYS;



  // ── Schedule state ───────────────────────────────────────────────────
  private nextScheduleId = 0;
  private scheduleBlocks = signal<ScheduleBlock[]>([]);

  constructor() {
    this.initScheduleFromWizard();
    this.reference.loadIfStale();

    effect(() => {
      const name = this.wizard.data().name;
      const completed = name.trim().length > 0;
      untracked(() => {
        if (completed) {
          this.wizard.markStepCompleted(STEP_GENERAL_ID);
        } else {
          this.wizard.markStepIncomplete(STEP_GENERAL_ID);
        }
      });
    });
  }

  onNameChange(value: string): void { this.wizard.updateData({ name: value }); }
  onDescriptionChange(value: string): void { this.wizard.updateData({ description: value }); }
  onSchedulingRequiredChange(value: boolean): void { this.wizard.updateData({ schedulingRequired: value }); }

  // ── Categories ───────────────────────────────────────────────────────
  isCategorySelected(id: number): boolean {
    return this.wizard.data().selectedCategoryIds.includes(id);
  }

  toggleCategory(id: number): void {
    const current = this.wizard.data().selectedCategoryIds;
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    this.onCategoriesChange(next);
  }

  onCategoriesChange(selectedIds: number[]): void {
    this.wizard.updateSelectedCategoryIds(selectedIds);

    const currentGroups = this.wizard.data().groups;
    const selectedSet = new Set(selectedIds);
    const kept: WizardGroupDraft[] = [];

    for (const group of currentGroups) {
      if (group.categoryId !== null && selectedSet.has(group.categoryId)) {
        kept.push({ ...group, productIds: [...group.productIds] });
        selectedSet.delete(group.categoryId);
      }
    }

    for (const id of selectedIds) {
      if (selectedSet.has(id)) {
        kept.push({
          id: null,
          categoryId: id,
          displayOrder: kept.length,
          required: true,
          minSelections: 1,
          maxSelections: 1,
          productIds: [],
        });
      }
    }

    const updated = kept.map((g, i) => ({ ...g, displayOrder: i }));
    this.wizard.updateGroups(updated);
  }

  // ── Schedule ─────────────────────────────────────────────────────────
  readonly scheduleBlocksForDisplay = this.scheduleBlocks.asReadonly();

  addScheduleBlock(): void {
    const now = new Date();
    this.scheduleBlocks.update((blocks) => [
      ...blocks,
      { id: this.nextScheduleId++, dayOfWeek: [], startTime: now, endTime: now },
    ]);
    this.syncScheduleToWizard();
  }

  removeScheduleBlock(id: number): void {
    this.scheduleBlocks.update((blocks) => blocks.filter((b) => b.id !== id));
    this.syncScheduleToWizard();
  }

  isDayInBlock(blockId: number, day: DayOfWeek): boolean {
    return this.scheduleBlocks().find((b) => b.id === blockId)?.dayOfWeek.includes(day) ?? false;
  }

  toggleBlockDay(blockId: number, day: DayOfWeek): void {
    this.scheduleBlocks.update((blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, dayOfWeek: b.dayOfWeek.includes(day) ? b.dayOfWeek.filter((d) => d !== day) : [...b.dayOfWeek, day] }
          : b,
      ),
    );
    this.syncScheduleToWizard();
  }

  onBlockStartTimeChange(blockId: number, date: Date): void {
    this.scheduleBlocks.update((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, startTime: date } : b)),
    );
    this.syncScheduleToWizard();
  }

  onBlockEndTimeChange(blockId: number, date: Date): void {
    this.scheduleBlocks.update((blocks) =>
      blocks.map((b) => (b.id === blockId ? { ...b, endTime: date } : b)),
    );
    this.syncScheduleToWizard();
  }

  private initScheduleFromWizard(): void {
    const entries = this.wizard.data().schedule;
    const merged = new Map<string, { days: DayOfWeek[]; startTime: string; endTime: string }>();
    for (const e of entries) {
      const key = `${e.startTime}-${e.endTime}`;
      const existing = merged.get(key) ?? { days: [], startTime: e.startTime, endTime: e.endTime };
      existing.days.push(e.dayOfWeek);
      merged.set(key, existing);
    }
    const blocks: ScheduleBlock[] = [];
    for (const value of merged.values()) {
      blocks.push({
        id: this.nextScheduleId++,
        dayOfWeek: value.days,
        startTime: this.parseTime(value.startTime),
        endTime: this.parseTime(value.endTime),
      });
    }
    this.scheduleBlocks.set(blocks);
  }

  private syncScheduleToWizard(): void {
    const entries: { dayOfWeek: DayOfWeek; startTime: string; endTime: string }[] = [];
    for (const block of this.scheduleBlocks()) {
      for (const day of block.dayOfWeek) {
        entries.push({ dayOfWeek: day, startTime: this.formatTime(block.startTime), endTime: this.formatTime(block.endTime) });
      }
    }
    this.wizard.updateSchedule(entries);
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  private parseTime(s: string): Date {
    const [h = 0, m = 0] = s.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
}
