import { HttpClient } from '@angular/common/http';

import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Logging } from '@app/core/services/logging/logging';

@Component({
  selector: 'app-product-creation-form',
  templateUrl: './product-creation-form.html',
  imports: [ReactiveFormsModule],
})
export class ProductCreationForm {
  private http = inject(HttpClient);
  private logger = inject(Logging);


  form = new FormGroup({
    name: new FormControl(''),
    price: new FormControl(''),
    description: new FormControl(''),
    estimateTime: new FormControl(0),
    preparationArea: new FormControl(1),
  });

  /**
   * availables preparation areas
   */
  preparationAreas = [
    { id: 1, name: 'Kitchen' },
    { id: 2, name: 'Bar' },
  ];



  createProduct() {
    this.http.post('products', {
      name: this.form.get('name')?.value,
      price: this.form.get('price')?.value,
      description: this.form.get('description')?.value,
      estimateTime: this.form.get('estimateTime')?.value,
      areaId: this.form.get('preparationArea')?.value,
    }).subscribe({
      next: (r) => this.logger.debug('Product created:', r),
      error: (er) => this.logger.error('Error creating product:', er)
    });
  }

  private fetchForAreas() {
    //
  }
}
