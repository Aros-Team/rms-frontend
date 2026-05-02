import { Component, EventEmitter, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { FloatLabelModule } from 'primeng/floatlabel';

@Component({
  selector: 'app-shared-datepicker',
  imports: [FormsModule, DatePickerModule, FloatLabelModule],
  templateUrl: './datepicker.html',
})
export class SharedDatepicker {
  // Modelo para selección de una sola fecha
  value: Date | null = null;

  // Emite cuando cambia la fecha seleccionada
  @Output() dateChange = new EventEmitter<Date | null>();

  onChange(date: Date | null): void {
    this.value = date;
    this.dateChange.emit(date);
  }
}