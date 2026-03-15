import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AreaService } from '@app/core/services/areas/area-service';
import { AreaSimpleResponse } from '@app/shared/models/dto/areas/area-simple-response';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { FormValidation } from '@app/shared/components/form/form-validation';

@Component({
  selector: 'app-areas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    DialogModule,
    IftaLabelModule,
    InputTextModule,
    SelectModule,
    FormValidation,
  ],
  template: `
    <div class="p-4">
      <div class="flex justify-between items-center mb-4">
        <div>
          <h2 class="text-2xl font-bold">Áreas de Trabajo</h2>
          <p class="text-surface-600 dark:text-surface-400">Gestiona las áreas donde trabajan los empleados</p>
        </div>
        <p-button label="Nueva Área" icon="pi pi-plus" (onClick)="showCreateModal()"></p-button>
      </div>

      <p-table [value]="areas" [tableStyle]="{'min-width': '50rem'}" stripedRows>
        <ng-template #header>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </ng-template>
        <ng-template #body let-area>
          <tr>
            <td>{{ area.name }}</td>
            <td>{{ area.type === 'KITCHEN' ? 'Cocina' : 'Bartender' }}</td>
            <td>
              <span [class]="area.enabled ? 'text-green-600' : 'text-red-600'">
                {{ area.enabled ? 'Activo' : 'Inactivo' }}
              </span>
            </td>
            <td class="flex gap-2">
              <p-button icon="pi pi-pencil" [text]="true" severity="secondary" (onClick)="showEditModal(area)"></p-button>
              <p-button icon="pi pi-power-off" [text]="true" [severity]="area.enabled ? 'danger' : 'success'" (onClick)="toggleArea(area)"></p-button>
            </td>
          </tr>
        </ng-template>
        <ng-template #emptymessage>
          <tr>
            <td colspan="4" class="text-center">No hay áreas registradas</td>
          </tr>
        </ng-template>
      </p-table>
    </div>

    <p-dialog 
      [header]="editMode ? 'Editar Área' : 'Nueva Área'" 
      [(visible)]="modalVisible" 
      [modal]="true"
      [style]="{width: '400px'}"
    >
      <form [formGroup]="form" class="flex flex-col gap-4">
        <p-iftalabel>
          <input pInputText id="name" formControlName="name" class="w-full" />
          <label for="name">Nombre</label>
          <form-validation field="name"></form-validation>
        </p-iftalabel>

        <p-iftalabel>
          <p-select
            [options]="areaTypes"
            formControlName="type"
            placeholder="Seleccionar tipo"
            class="w-full"
            optionLabel="label"
            optionValue="value"
          />
          <label for="type">Tipo de área</label>
          <form-validation field="type"></form-validation>
        </p-iftalabel>
      </form>

      <ng-template pTemplate="footer">
        <p-button label="Cancelar" severity="secondary" (onClick)="modalVisible = false"></p-button>
        <p-button [label]="editMode ? 'Actualizar' : 'Crear'" (onClick)="saveArea()"></p-button>
      </ng-template>
    </p-dialog>
  `
})
export class Areas implements OnInit {
  private areaService = inject(AreaService);
  private fb = inject(FormBuilder);

  areas: AreaSimpleResponse[] = [];
  modalVisible = false;
  editMode = false;
  selectedArea?: AreaSimpleResponse;

  form: FormGroup = this.fb.group({
    name: ['', Validators.required],
    type: ['', Validators.required],
  });

  areaTypes = [
    { label: 'Cocina', value: 'KITCHEN' },
    { label: 'Bartender', value: 'BARTENDER' },
  ];

  ngOnInit(): void {
    this.loadAreas();
  }

  loadAreas(): void {
    this.areaService.getAreas().subscribe({
      next: (areas) => this.areas = areas,
      error: (err) => console.error('Error loading areas:', err),
    });
  }

  showCreateModal(): void {
    this.editMode = false;
    this.form.reset();
    this.modalVisible = true;
  }

  showEditModal(area: AreaSimpleResponse): void {
    this.editMode = true;
    this.selectedArea = area;
    this.form.patchValue({
      name: area.name,
      type: area.type,
    });
    this.modalVisible = true;
  }

  saveArea(): void {
    if (this.form.invalid) return;

    const data = this.form.value;

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
  }

  toggleArea(area: AreaSimpleResponse): void {
    this.areaService.toggleArea(area.id).subscribe({
      next: () => this.loadAreas(),
    });
  }
}
