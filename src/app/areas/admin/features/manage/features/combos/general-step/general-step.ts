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
import { DatePickerModule } from 'primeng/datepicker';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { TextareaModule } from 'primeng/textarea';

import { Area } from '@app/core/services/areas/area';
import { ComboReferenceCache } from '@app/core/services/combos/combo-reference-cache';
import {
  ComboWizardState,
  type WizardGroupDraft,
} from '@app/core/services/combos/combo-wizard-state';
import type { AreaResponse } from '@app/shared/models/dto/areas/area.model';
import type { DayOfWeek } from '@app/shared/models/dto/special-selections/schedule-entry';

const STEP_GENERAL_ID = 'general';

const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Lunes',
  TUESDAY: 'Martes',
  WEDNESDAY: 'Miércoles',
  THURSDAY: 'Jueves',
  FRIDAY: 'Viernes',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

const ALL_DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'MONDAY', label: 'Lunes' },
  { value: 'TUESDAY', label: 'Martes' },
  { value: 'WEDNESDAY', label: 'Miércoles' },
  { value: 'THURSDAY', label: 'Jueves' },
  { value: 'FRIDAY', label: 'Viernes' },
  { value: 'SATURDAY', label: 'Sábado' },
  { value: 'SUNDAY', label: 'Domingo' },
];

interface ScheduleEntryView {
  id: number;
  dayOfWeek: DayOfWeek;
  dayLabel: string;
  startTime: Date;
  endTime: Date;
}

@Component({
  selector: 'app-general-step[comboWizardStep=general]',
  imports: [
    FormsModule,
    ButtonModule,
    DatePickerModule,
    CheckboxModule,
    InputNumberModule,
    InputTextModule,
    MultiSelectModule,
    SelectButtonModule,
    SelectModule,
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
  private readonly areaService = inject(Area);

  readonly ref = this.reference;
  readonly wizardData = this.wizard.data;

  readonly areas = signal<AreaResponse[]>([]);
  readonly isLoading = computed(() => this.reference.isLoading());

  readonly allDays = ALL_DAYS;

  readonly activeOptions = [
    { label: 'Sí', value: true },
    { label: 'No', value: false },
  ];

  // ── Schedule state ───────────────────────────────────────────────────
  private nextScheduleId = 0;
  private scheduleEntries = signal<ScheduleEntryView[]>([]);

  readonly groupedSchedule = computed(() => {
    const map = new Map<DayOfWeek, ScheduleEntryView[]>();
    for (const entry of this.scheduleEntries()) {
      const group = map.get(entry.dayOfWeek) ?? [];
      group.push(entry);
      map.set(entry.dayOfWeek, group);
    }
    return map;
  });

  readonly unselectedDays = computed(() => {
    const used = new Set(this.scheduleEntries().map((e) => e.dayOfWeek));
    return ALL_DAYS.filter((d) => !used.has(d.value));
  });

  readonly showDaySelector = signal(false);

  constructor() {
    this.initScheduleFromWizard();
    this.reference.loadIfStale();
    this.loadAreas();

    effect(() => {
      const { name, basePrice } = this.wizard.data();
      if (name.trim().length > 0 && basePrice !== null) {
        this.wizard.markStepCompleted(STEP_GENERAL_ID);
      } else {
        untracked(() => {
          this.wizard.markStepIncomplete(STEP_GENERAL_ID);
        });
      }
    });
  }

  private loadAreas(): void {
    this.areaService.getAreas().subscribe((data) => {
      this.areas.set(data);
    });
  }

  onNameChange(value: string): void { this.wizard.updateData({ name: value }); }
  onDescriptionChange(value: string): void { this.wizard.updateData({ description: value }); }
  onBasePriceChange(value: number | null): void { this.wizard.updateData({ basePrice: value }); }
  onAreaIdChange(value: number | null): void { this.wizard.updateData({ areaId: value }); }
  onActiveChange(value: boolean): void { this.wizard.updateData({ active: value }); }
  onBaseRecipeChange(value: boolean): void { this.wizard.updateData({ baseRecipeEnabled: value }); }
  onSchedulingRequiredChange(value: boolean): void { this.wizard.updateData({ schedulingRequired: value }); }

  // ── Categories ───────────────────────────────────────────────────────
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
  addScheduleDay(dayOfWeek: DayOfWeek): void {
    const now = new Date();
    this.scheduleEntries.update((entries) => [
      ...entries,
      {
        id: this.nextScheduleId++,
        dayOfWeek,
        dayLabel: DAY_LABELS[dayOfWeek],
        startTime: now,
        endTime: now,
      },
    ]);
    this.showDaySelector.set(false);
    this.syncScheduleToWizard();
  }

  removeScheduleEntry(id: number): void {
    this.scheduleEntries.update((entries) => entries.filter((e) => e.id !== id));
    this.syncScheduleToWizard();
  }

  onStartTimeChange(id: number, date: Date): void {
    this.scheduleEntries.update((entries) =>
      entries.map((e) => (e.id === id ? { ...e, startTime: date } : e)),
    );
    this.syncScheduleToWizard();
  }

  onEndTimeChange(id: number, date: Date): void {
    this.scheduleEntries.update((entries) =>
      entries.map((e) => (e.id === id ? { ...e, endTime: date } : e)),
    );
    this.syncScheduleToWizard();
  }

  private initScheduleFromWizard(): void {
    const entries = this.wizard.data().schedule.map((e) => ({
      id: this.nextScheduleId++,
      dayOfWeek: e.dayOfWeek,
      dayLabel: DAY_LABELS[e.dayOfWeek],
      startTime: this.parseTime(e.startTime),
      endTime: this.parseTime(e.endTime),
    }));
    this.scheduleEntries.set(entries);
  }

  private syncScheduleToWizard(): void {
    const entries = this.scheduleEntries().map((e) => ({
      dayOfWeek: e.dayOfWeek,
      startTime: this.formatTime(e.startTime),
      endTime: this.formatTime(e.endTime),
    }));
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
