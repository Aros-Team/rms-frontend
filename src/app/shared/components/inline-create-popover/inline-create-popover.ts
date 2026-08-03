import { Component, Input, Output, EventEmitter, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Popover, PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { SelectItem } from 'primeng/api';

export interface InlineCreateField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: SelectItem[]; // for select type
}

@Component({
  selector: 'app-inline-create-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, PopoverModule, ButtonModule, InputTextModule, InputNumberModule, SelectModule],
  templateUrl: './inline-create-popover.html',
  styleUrl: './inline-create-popover.css',
})
export class InlineCreatePopover {
  @Input() title = 'Crear';
  @Input() fields: InlineCreateField[] = [];
  @Input() submitLabel = 'Crear';
  @Input() cancelLabel = 'Cancelar';
  @Input() submitting = signal(false);

  @Output() submitted = new EventEmitter<Record<string, unknown>>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() visibleChange = new EventEmitter<boolean>();

  @ViewChild('popover') popover!: Popover;

  visible = signal(false);

  // Internal form model
  formValues: Record<string, unknown> = {};

  toggle(event: Event): void {
    this.popover.toggle(event);
  }

  onPopoverShow(): void {
    this.visible.set(true);
    this.visibleChange.emit(true);
  }

  onPopoverHide(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }

  close(): void {
    if (!this.submitting()) {
      this.popover.hide();
      this.cancelled.emit();
    }
  }

  onSubmit(): void {
    // Check required fields
    const missing = this.fields.filter(f => f.required && (!this.formValues[f.name] || this.formValues[f.name] === ''));
    if (missing.length > 0) return;

    this.submitting.set(true);
    this.submitted.emit({ ...this.formValues });
  }

  reset(): void {
    this.formValues = {};
    this.fields.forEach(f => { this.formValues[f.name] = f.type === 'number' ? null : ''; });
  }
}
