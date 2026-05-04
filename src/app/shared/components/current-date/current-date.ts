import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'app-current-date',
  imports: [CommonModule, FormsModule, DatePickerModule],
  templateUrl: './current-date.html',
  styleUrl: './current-date.css',
})
export class CurrentDate {
  currentDate = signal(new Date());
  maxDate = new Date(2099, 11, 31);
  minDate = new Date(2000, 0, 1);

  formattedMonth = computed(() => {
    return this.currentDate().toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric'
    });
  });
}