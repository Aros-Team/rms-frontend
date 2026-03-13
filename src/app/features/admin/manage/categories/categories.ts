import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { CategoryService } from '@app/core/services/category/category-service';
import { FormValidation } from '@app/shared/components/form/form-validation';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';
import { OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

@Component({
  selector: 'app-categories',
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    IftaLabelModule,
    InputTextModule,
    ButtonModule,
    FormValidation,
    ChipModule,
    DialogModule,
    ConfirmDialogModule,
  ],
  templateUrl: './categories.html',
  styles: ``,
})
export class Categories implements OnInit {
  title = 'Categorías';
  description = 'Gestiona las categorías de productos del restaurante';

  formBuilder = inject(FormBuilder);
  private categoryService = inject(CategoryService);
  private messageService = inject(MessageService);
  confirm = inject(ConfirmationService);

  form: FormGroup = this.formBuilder.group({
    name: ['', Validators.required],
  });

  saved = false;
  errorMsg: string | null = null;
  activeCategories: CategorySimpleResponse[] = [];
  inactiveCategories: CategorySimpleResponse[] = [];

  ngOnInit(): void {
    this.refresh();
  }

  saveCategory(): void {
    this.saved = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.categoryService.createCategory({ name: this.form.get('name')?.value }).subscribe({
      next: () => {
        this.errorMsg = null;
        this.saved = true;
        this.form.reset();
        this.refresh();
      },
      error: () => {
        this.saved = false;
        this.errorMsg = 'No se pudo guardar la categoría';
      },
    });
  }

  public confirmCategoryToggle(id: number) {
    this.confirm.confirm({
      message:
        '<b>¿Estás seguro de cambiar el estado de esta categoria?</b>',
      header: 'Confirmacion',
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.toggleCategory(id);
      },
      acceptLabel: "Confirmar",
      rejectLabel: "Cancelar"
    });
  }

  public toggleCategory(id: number): void {
    this.categoryService.toggleCategory(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Operacion exitosa.',
          detail: 'Se actualizo el estado de la categoria',
          life: 3000,
        });
        this.refresh();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error en la operacion.',
          detail: 'No se pudo actualizar la categoría.',
          life: 3000,
        });
      },
    });
  }

  private refresh(): void {
    this.categoryService.getCategories().subscribe((res) => {
      this.activeCategories = res.filter(c => c.enabled);
      this.inactiveCategories = res.filter(c => !c.enabled);
    });
  }
}
