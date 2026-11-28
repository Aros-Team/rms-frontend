import { Component, OnInit, OnDestroy, inject, computed, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Area } from '@app/core/services/areas/area';
import { FloorLayoutApi } from '@app/core/services/floor-layout/floor-layout';
import { AreaRequest, AreaActivityValue } from '@app/shared/models/dto/areas/area';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import type { FloorLayout } from '@app/shared/models/dto/floor-layout/floor-layout';
import { Auth } from '@app/core/services/auth/auth';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { fieldError as resolveFieldError } from '@app/shared/lib/form-error';
import { extractProblemDetail } from '@app/shared/lib/problem-detail/problem-detail';
import { TablesCache } from '../tables/tables-cache';
import { LazyLoad } from '@app/core/directives/lazy-load/lazy-load.directive';
import { TableSkeleton } from '@shared/skeletons/table-skeleton/table-skeleton';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsCheckbox } from '@app/shared/ui/checkbox/checkbox';
import { RmsDialog } from '@app/shared/ui/dialog/dialog';
import { RmsInput } from '@app/shared/ui/input/input';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsPageHeader } from '@app/shared/ui/page-header/page-header';
import { RmsSkeleton } from '@app/shared/ui/skeleton/skeleton';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';

import { FloorLayout as FloorLayoutEditor } from './layout/floor-layout';
import { LayoutPreview } from './layout/components/layout-preview/layout-preview';

@Component({
  selector: 'app-areas',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    DialogModule,
    IconFieldModule,
    InputIconModule,
    LazyLoad,
    TableSkeleton,
    RmsButton,
    RmsCheckbox,
    RmsDialog,
    RmsIconButton,
    RmsPageHeader,
    RmsSkeleton,
    RmsStatusPill,
    RmsInput,
    FloorLayoutEditor,
    LayoutPreview,
  ],
  templateUrl: './areas.html',
})
export class Areas implements OnInit, OnDestroy {
  private areaService = inject(Area);
  private readonly layoutApi = inject(FloorLayoutApi);
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private messages = inject(MessageService);
  private areasSubscription: Subscription | null = null;
  readonly cache = inject(TablesCache);

  areas = computed(() => this.cache.areas.data() ?? []);
  modalVisible = false;
  editMode = false;
  selectedArea?: AreaSimpleResponse;

  readonly editorOpen = signal(false);
  readonly layoutPreview = signal<FloorLayout | null>(null);
  readonly layoutPreviewLoading = signal(true);
  readonly layoutPreviewError = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    name: ['', (control: AbstractControl) => Validators.required(control)],
    activities: [
      [] as AreaActivityValue[],
      (control: AbstractControl) => Validators.required(control),
    ],
    exclusive: [false],
  });

  /** Activities that can be performed in an area. */
  readonly activityOptions: { label: string; value: AreaActivityValue }[] = [
    { label: 'Preparación de productos', value: 'PREPARATION' },
    { label: 'Atención al cliente', value: 'SERVE' },
    { label: 'Caja', value: 'CASH' },
  ];

  activityLabels(activities: AreaActivityValue[] | undefined): string {
    if (!activities || activities.length === 0) return 'Sin actividades';
    return activities
      .map(
        (activity) =>
          this.activityOptions.find((item) => item.value === activity)?.label ?? activity,
      )
      .join(', ');
  }

  isActivitySelected(activity: AreaActivityValue): boolean {
    return (
      (this.form.get('activities')?.value as AreaActivityValue[] | null)?.includes(activity) ??
      false
    );
  }

  toggleActivity(activity: AreaActivityValue, checked: boolean): void {
    const current = (this.form.get('activities')?.value as AreaActivityValue[] | null) ?? [];
    const next = checked
      ? [...new Set([...current, activity])]
      : current.filter((value) => value !== activity);
    this.form.patchValue({ activities: next });
  }

  /** Validation copy for a control, rendered by the primitive's `[error]`. */
  fieldError(field: string): string {
    return resolveFieldError(this.form, field);
  }

  ngOnInit(): void {
    this.cache.areas.loadIfStale();
    this.loadLayoutPreview();
  }

  onVisible(): void {
    this.cache.areas.loadIfStale();
    this.loadLayoutPreview();
  }

  loadAreas(): void {
    this.cache.areas.refresh();
  }

  loadLayoutPreview(): void {
    this.layoutPreviewLoading.set(true);
    this.layoutPreviewError.set(null);
    this.layoutApi.getLayout().subscribe({
      next: (layout) => {
        this.layoutPreview.set(layout);
        this.layoutPreviewLoading.set(false);
      },
      error: (error: unknown) => {
        this.layoutPreview.set(null);
        this.layoutPreviewError.set(
          extractProblemDetail(error) ?? 'No se pudo cargar la distribución.',
        );
        this.layoutPreviewLoading.set(false);
      },
    });
  }

  openEditor = (): void => {
    this.editorOpen.set(true);
  };

  onEditorClosed(): void {
    this.editorOpen.set(false);
    this.loadLayoutPreview();
  }

  onEditorVisible(visible: boolean): void {
    this.editorOpen.set(visible);
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
      activities: [...area.activities],
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
        error: (error: unknown) => {
          this.showSaveError(error);
        },
      });
    } else {
      this.areaService.createArea(data).subscribe({
        next: () => {
          this.loadAreas();
          this.modalVisible = false;
        },
        error: (error: unknown) => {
          this.showSaveError(error);
        },
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
      next: () => {
        this.loadAreas();
      },
    });
  };
}
