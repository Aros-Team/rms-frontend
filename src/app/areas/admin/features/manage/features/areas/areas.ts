import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Area } from '@app/core/services/areas/area';
import { AreaRequest, AreaTypeValue } from '@app/shared/models/dto/areas/area';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { Auth } from '@app/core/services/auth/auth';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { fieldError as resolveFieldError } from '@app/shared/lib/form-error';
import { TablesCache } from '../tables/tables-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCheckbox } from '@app/shared/ui/checkbox/checkbox';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsSelect } from '@app/shared/ui/select/select';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';

@Component({
  selector: 'app-areas',
  imports: [
    ReactiveFormsModule,
    TableModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    LazyLoad,
    TableSkeleton,
    RmsButton,
    RmsCheckbox,
    RmsIconButton,
    RmsPageHeader,
    RmsStatusPill,
    RmsInput,
    RmsSelect,
  ],
  templateUrl: './areas.html'
})
export class Areas implements OnInit, OnDestroy {
  private areaService = inject(Area);
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private messages = inject(MessageService);
  private areasSubscription: Subscription | null = null;
  readonly cache = inject(TablesCache);

  areas = computed(() => this.cache.areas.data() ?? []);
  modalVisible = false;
  editMode = false;
  selectedArea?: AreaSimpleResponse;

  form: FormGroup = this.fb.group({
    name: ['', (control: AbstractControl) => Validators.required(control)],
    type: ['', (control: AbstractControl) => Validators.required(control)],
    exclusive: [false],
  });

  /** Area types accepted by the API (`AreaType` enum). */
  readonly areaTypes: { label: string; value: AreaTypeValue }[] = [
    { label: 'Cocina', value: 'KITCHEN' },
    { label: 'Servicio', value: 'SERVICE' },
    { label: 'Bar', value: 'BAR' },
    { label: 'Parrilla', value: 'GRILL' },
    { label: 'Caja', value: 'CASH' },
  ];

  areaTypeLabel(type: AreaTypeValue): string {
    return this.areaTypes.find((t) => t.value === type)?.label ?? type;
  }

  /** Validation copy for a control, rendered by the primitive's `[error]`. */
  fieldError(field: string): string {
    return resolveFieldError(this.form, field);
  }

  ngOnInit(): void {
    this.cache.areas.loadIfStale();
  }

  onVisible(): void {
    this.cache.areas.loadIfStale();
  }

  loadAreas(): void {
    this.cache.areas.refresh();
  }

  ngOnDestroy(): void {
    if (this.areasSubscription) {
      this.areasSubscription.unsubscribe();
    }
  }

  showCreateModal = (): void => {
    this.editMode = false;
    this.form.reset();
    this.modalVisible = true;
  };

  showEditModal = (area: AreaSimpleResponse): void => {
    this.editMode = true;
    this.selectedArea = area;
    this.form.patchValue({
      name: area.name,
      type: area.type,
      exclusive: area.exclusive === true,
    });
    this.modalVisible = true;
  };

  saveArea = (): void => {
    if (this.form.invalid) return;

    const data = this.form.value as AreaRequest;

    if (this.editMode && this.selectedArea) {
      this.areaService.updateArea(this.selectedArea.id, data).subscribe({
        next: () => {
          this.loadAreas();
          this.modalVisible = false;
        },
        error: (error: unknown) => { this.showSaveError(error); },
      });
    } else {
      this.areaService.createArea(data).subscribe({
        next: () => {
          this.loadAreas();
          this.modalVisible = false;
        },
        error: (error: unknown) => { this.showSaveError(error); },
      });
    }
  };

  private showSaveError(error: unknown): void {
    const detail =
      error !== null && typeof error === 'object' && 'error' in error
        ? (error as { error?: { detail?: string } }).error?.detail
        : undefined;
    this.messages.add({
      severity: 'error',
      summary: 'No se pudo guardar el área',
      detail: detail ?? 'Revisa los datos e inténtalo de nuevo.',
      life: 6000,
    });
  }

  toggleArea = (area: AreaSimpleResponse): void => {
    this.areaService.toggleArea(area.id).subscribe({
      next: () => { this.loadAreas(); },
    });
  };
}