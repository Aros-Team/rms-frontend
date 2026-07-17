import { Component, inject, signal, computed, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';

import { DecimalPipe } from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { OrderList } from 'primeng/orderlist';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { MessageModule } from 'primeng/message';
import { ChipModule } from 'primeng/chip';
import { MessageService } from 'primeng/api';

import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError } from '@app/shared/lib/http-error-mapper';
import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { SpecialSelectionRequest } from '@app/shared/models/dto/special-selections/special-selection-request';
import { SpecialSelectionResponse } from '@app/shared/models/dto/special-selections/special-selection-response';
import { SpecialSelectionGroupRequest } from '@app/shared/models/dto/special-selections/special-selection-group';
import { SpecialSelectionAdditionRequest } from '@app/shared/models/dto/special-selections/special-selection-addition';
import { SpecialSelectionQuestionRequest } from '@app/shared/models/dto/special-selections/special-selection-question';
import { ScheduleEntryRequest } from '@app/shared/models/dto/special-selections/schedule-entry';
import { SuggestedPriceResponse } from '@app/shared/models/dto/special-selections/special-selection-suggested-price';
import { Area } from '@app/core/services/areas/area';
import { AreaResponse } from '@app/shared/models/dto/areas/area.model';

// ─── Schedule UI types ──────────────────────────────────────────────────────
interface ScheduleEntry {
  startTime: string;
  endTime: string;
}

interface ScheduleDay {
  value: string;
  label: string;
  entries: ScheduleEntry[];
}

@Component({
  selector: 'app-combo-editor',
  imports: [
    FormsModule,
    RouterModule,
    ButtonModule,
    TabsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitch,
    TextareaModule,
    ToastModule,
    OrderList,
    DialogModule,
    TableModule,
    MessageModule,
    ChipModule,
    DecimalPipe,
  ],
  providers: [MessageService],
  templateUrl: './combo-editor.html',
  styleUrl: './combo-editor.css',
})
export class ComboEditor {
  private readonly cache = inject(SpecialSelectionsCacheService);
  private readonly areaService = inject(Area);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  // ─── Route params ──────────────────────────────────────────────────────
  private readonly paramMap = toSignal(this.route.paramMap);

  isNew = computed(() => !this.paramMap()?.has('id'));
  comboId = computed(() => {
    const id = this.paramMap()?.get('id');
    return id ? Number(id) : null;
  });

  // ─── Tabs ───────────────────────────────────────────────────────────────
  activeTab = signal<string | number>(0);

  // ─── Form state ─────────────────────────────────────────────────────────
  name = signal('');
  description = signal('');
  basePrice = signal(0);
  areaId = signal<number | null>(null);
  active = signal(true);
  baseRecipeEnabled = signal(false);
  schedulingRequired = signal(false);

  // ─── Sub-form state (Grupos, Adiciones, Preguntas) ──────────────────────
  editableGroups = signal<SpecialSelectionGroupRequest[]>([]);
  editableAdditions = signal<SpecialSelectionAdditionRequest[]>([]);
  editableQuestions = signal<SpecialSelectionQuestionRequest[]>([]);
  schedule = signal<ScheduleEntryRequest[]>([]);

  // ─── Horario tab state ──────────────────────────────────────────────────
  readonly scheduleDays: ScheduleDay[] = [
    { value: 'MONDAY', label: 'Lun', entries: [] },
    { value: 'TUESDAY', label: 'Mar', entries: [] },
    { value: 'WEDNESDAY', label: 'Mié', entries: [] },
    { value: 'THURSDAY', label: 'Jue', entries: [] },
    { value: 'FRIDAY', label: 'Vie', entries: [] },
    { value: 'SATURDAY', label: 'Sáb', entries: [] },
    { value: 'SUNDAY', label: 'Dom', entries: [] },
  ];

  scheduleErrors = signal<string[]>([]);

  // ─── Related data ──────────────────────────────────────────────────────
  areas = signal<AreaResponse[]>([]);
  loading = signal(false);
  saving = signal(false);

  // ─── Suggested price dialog ────────────────────────────────────────────
  showPriceDialog = signal(false);
  priceMargin = signal(30);
  priceResult = signal<SuggestedPriceResponse | null>(null);
  priceLoading = signal(false);
  priceError = signal<string | null>(null);
  priceMissingVariants = signal<number[]>([]);

  constructor() {
    this.loadAreas();

    const id = this.comboId();
    if (id !== null) {
      const detail = this.cache.detail(id);
      detail.load();
      effect(() => {
        const data = detail.data();
        if (data) {
          this.populateForm(data);
        }
      }, { allowSignalWrites: true });
    }
  }

  private loadAreas(): void {
    this.loading.set(true);
    this.areaService.getAreas().pipe(
      catchError(() => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudieron cargar las áreas',
        });
        return EMPTY;
      }),
    ).subscribe((data) => {
      this.areas.set(data);
      this.loading.set(false);
    });
  }

  private populateForm(data: SpecialSelectionResponse): void {
    this.name.set(data.name);
    this.description.set(data.description);
    this.basePrice.set(data.basePrice);
    this.areaId.set(data.preparationAreaId);
    this.active.set(data.active);
    this.baseRecipeEnabled.set(data.baseRecipeEnabled);
    this.schedulingRequired.set(data.schedulingRequired);
    this.editableGroups.set(data.groups.map(g => ({
      id: g.id,
      categoryId: g.categoryId,
      displayOrder: g.displayOrder,
      required: g.required,
      minSelections: g.minSelections,
      maxSelections: g.maxSelections,
      productIds: [...g.productIds],
    })));
    this.editableAdditions.set(data.additions.map(a => ({
      name: a.name,
      optionId: a.optionId,
      extraPrice: a.extraPrice,
      displayOrder: a.displayOrder,
    })));
    this.editableQuestions.set(data.questions.map(q => ({
      question: q.question,
      required: q.required,
      displayOrder: q.displayOrder,
    })));
    this.schedule.set(data.schedule.map(s => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    })));

    // Populate scheduleDays from response
    if (data.schedule.length > 0) {
      for (const day of this.scheduleDays) {
        const matches = data.schedule.filter(s => s.dayOfWeek === day.value);
        day.entries = matches.map(s => ({ startTime: s.startTime, endTime: s.endTime }));
      }
    }
  }

  save(): void {
    // Sync UI state to schedule signal
    this.syncScheduleToSignal();

    // Validate schedule
    const errors = this.validateSchedule();
    if (errors.length > 0) {
      this.scheduleErrors.set(errors);
      this.activeTab.set(4);
      return;
    }
    this.scheduleErrors.set([]);

    const req: SpecialSelectionRequest = {
      name: this.name(),
      description: this.description(),
      basePrice: this.basePrice(),
      active: this.active(),
      baseRecipeEnabled: this.baseRecipeEnabled(),
      schedulingRequired: this.schedulingRequired(),
      groups: this.editableGroups(),
      additions: this.editableAdditions(),
      questions: this.editableQuestions(),
      schedule: this.schedule(),
    };

    this.saving.set(true);
    const id = this.comboId();
    const obs = id !== null
      ? this.cache.update(id, req)
      : this.cache.create(req);

    obs.pipe(
      catchError(() => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el combo',
        });
        this.saving.set(false);
        return EMPTY;
      }),
    ).subscribe(() => {
      this.saving.set(false);
      this.messageService.add({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Combo guardado correctamente',
      });
      void this.router.navigate(['/admin/manage/combos']);
    });
  }

  // ─── Grupo helpers ─────────────────────────────────────────────────────
  addGroup(): void {
    this.editableGroups.update(g => [...g, {
      categoryId: null, displayOrder: g.length + 1, required: false,
      minSelections: 1, maxSelections: 1, productIds: [],
    }]);
  }

  removeGroup(index: number): void {
    this.editableGroups.update(g => g.filter((_, i) => i !== index));
  }

  onGroupReorder(): void {
    this.editableGroups.update(g => g.map((item, i) => ({ ...item, displayOrder: i + 1 })));
  }

  // ─── Adición helpers ────────────────────────────────────────────────────
  addAddition(): void {
    this.editableAdditions.update(a => [...a, {
      name: '', optionId: 0, extraPrice: 0, displayOrder: a.length + 1,
    }]);
  }

  removeAddition(index: number): void {
    this.editableAdditions.update(a => a.filter((_, i) => i !== index));
  }

  // ─── Pregunta helpers ───────────────────────────────────────────────────
  addQuestion(): void {
    this.editableQuestions.update(q => [...q, {
      question: '', required: false, displayOrder: q.length + 1,
    }]);
  }

  removeQuestion(index: number): void {
    this.editableQuestions.update(q => q.filter((_, i) => i !== index));
  }

  // ─── Horario helpers ────────────────────────────────────────────────────
  addScheduleEntry(dayValue: string): void {
    const day = this.scheduleDays.find(d => d.value === dayValue);
    if (day) {
      day.entries = [...day.entries, { startTime: '', endTime: '' }];
      this.scheduleErrors.set([]);
    }
  }

  removeScheduleEntry(dayValue: string, index: number): void {
    const day = this.scheduleDays.find(d => d.value === dayValue);
    if (day) {
      day.entries = day.entries.filter((_, i) => i !== index);
      this.syncScheduleToSignal();
    }
  }

  updateScheduleTime(dayValue: string, index: number, field: 'startTime' | 'endTime', value: string): void {
    const day = this.scheduleDays.find(d => d.value === dayValue);
    if (day?.entries[index]) {
      day.entries[index] = { ...day.entries[index], [field]: value };
      this.syncScheduleToSignal();
    }
  }

  private syncScheduleToSignal(): void {
    const entries: ScheduleEntryRequest[] = [];
    for (const day of this.scheduleDays) {
      for (const entry of day.entries) {
        if (entry.startTime && entry.endTime) {
          entries.push({
            dayOfWeek: day.value as ScheduleEntryRequest['dayOfWeek'],
            startTime: entry.startTime,
            endTime: entry.endTime,
          });
        }
      }
    }
    this.schedule.set(entries);
  }

  private validateSchedule(): string[] {
    const errors: string[] = [];
    for (const day of this.scheduleDays) {
      for (const entry of day.entries) {
        if (entry.startTime && entry.endTime && entry.startTime >= entry.endTime) {
          errors.push(
            `Horario inválido en ${day.label}: la hora de inicio (${entry.startTime}) debe ser menor a la hora de fin (${entry.endTime})`
          );
        }
      }
    }
    return errors;
  }

  // ─── Suggested price dialog ────────────────────────────────────────────
  openPriceDialog(): void {
    this.showPriceDialog.set(true);
    this.priceResult.set(null);
    this.priceError.set(null);
    this.priceMissingVariants.set([]);
  }

  calculatePrice(): void {
    const id = this.comboId();
    if (id === null) return;

    this.priceLoading.set(true);
    this.priceError.set(null);
    this.priceResult.set(null);

    this.cache.suggestPrice(id, this.priceMargin()).subscribe({
      next: (result) => {
        this.priceResult.set(result);
        this.priceLoading.set(false);
      },
      error: (err: unknown) => {
        this.priceLoading.set(false);
        if (err instanceof HttpErrorResponse && err.status === 422) {
          const body = err.error as { missingVariants?: number[] } | null;
          this.priceError.set(mapHttpError(err, 'special-selections'));
          this.priceMissingVariants.set(body?.missingVariants ?? []);
          return;
        }
        if (err instanceof HttpErrorResponse) {
          this.priceError.set(mapHttpError(err));
        } else {
          this.priceError.set(err instanceof Error ? err.message : 'Error al calcular precio sugerido');
        }
      },
    });
  }

  applySuggestedPrice(): void {
    const result = this.priceResult();
    if (result) {
      this.basePrice.set(result.suggestedPrice);
      this.showPriceDialog.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/admin/manage/combos']);
  }
}
