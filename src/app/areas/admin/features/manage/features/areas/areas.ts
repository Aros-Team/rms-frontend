import { Component, OnInit, OnDestroy, inject, computed } from '@angular/core';
import { Subscription } from 'rxjs';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Area } from '@app/core/services/areas/area';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { Auth } from '@app/core/services/auth/auth';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { TablesCacheService } from '../tables/tables-cache.service';
import { LazyLoadDirective } from '@app/core/directives/lazy-load.directive';
import { TableSkeleton } from '@shared/skeletons/table-skeleton';

@Component({
  selector: 'app-areas',
  imports: [
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    IftaLabelModule,
    InputTextModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
FormValidation,
    LazyLoadDirective,
    TableSkeleton
  ],
  templateUrl: './areas.html'
})
export class Areas implements OnInit, OnDestroy {
  private areaService = inject(Area);
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private areasSubscription: Subscription | null = null;
  readonly cache = inject(TablesCacheService);

  areas = computed(() => this.cache.areas.data() ?? []);
  modalVisible = false;
  editMode = false;
  selectedArea?: AreaSimpleResponse;

  form: FormGroup = this.fb.group({
    name: ['', (control: AbstractControl) => Validators.required(control)],
    type: ['', (control: AbstractControl) => Validators.required(control)],
  });

  areaTypes = [
    { label: 'Cocina', value: 'KITCHEN' },
    { label: 'Bartender', value: 'BARTENDER' },
  ];

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
    });
    this.modalVisible = true;
  };

  saveArea = (): void => {
    if (this.form.invalid) return;

    const data = this.form.value as { name: string; type: 'KITCHEN' | 'BARTENDER' };

    if (this.editMode && this.selectedArea) {
      this.areaService.updateArea(this.selectedArea.id, data).subscribe({
        next: () => {
          this.loadAreas();
          this.modalVisible = false;
        },
      });
    } else {
      this.areaService.createArea(data).subscribe({
        next: () => {
          this.loadAreas();
          this.modalVisible = false;
        },
      });
    }
  };

  toggleArea = (area: AreaSimpleResponse): void => {
    this.areaService.toggleArea(area.id).subscribe({
      next: () => { this.loadAreas(); },
    });
  };
}