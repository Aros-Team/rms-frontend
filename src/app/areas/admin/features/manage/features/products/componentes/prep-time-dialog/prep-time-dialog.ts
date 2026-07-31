import { Component, inject, signal, computed, effect, Output, EventEmitter, Input, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AbstractControl, FormBuilder, FormControl, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputNumberModule } from 'primeng/inputnumber';

export interface PrepTimeFormControls {
  calmMinutes: FormControl<number | null>;
  peakMinutes: FormControl<number | null>;
  interruptionMinutes: FormControl<number | null>;
}

export interface PrepTimeFormValue {
  calmMinutes: number | null;
  peakMinutes: number | null;
  interruptionMinutes: number | null;
}

export interface PrepTimeEstimate {
  calmMinutes: number;
  peakMinutes: number;
  interruptionMinutes: number;
  estimatedPrepMinutes: number;
}

export function estimatePrepMinutes(calmMinutes: number, peakMinutes: number, interruptionMinutes: number): number {
  return Math.ceil((calmMinutes + peakMinutes + interruptionMinutes) / 3);
}

@Component({
  selector: 'app-prep-time-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    IftaLabelModule,
    InputNumberModule,
  ],
  templateUrl: './prep-time-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrepTimeDialog {
  @Input() visible = signal(false);
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() estimateApplied = new EventEmitter<PrepTimeEstimate>();

  @Input() initialEstimate: PrepTimeEstimate | null = null;

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  prepTimeForm = this.fb.group<PrepTimeFormControls>({
    calmMinutes: this.fb.control<number | null>(null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0)(control)]),
    peakMinutes: this.fb.control<number | null>(null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0)(control)]),
    interruptionMinutes: this.fb.control<number | null>(null, [(control: AbstractControl) => Validators.required(control), (control: AbstractControl) => Validators.min(0)(control)]),
  });

  // ReactiveForms emits through valueChanges; mirror it into a signal so the
  // computed re-runs as the admin types instead of caching the first value.
  private readonly formValue = signal<PrepTimeFormValue>({ calmMinutes: null, peakMinutes: null, interruptionMinutes: null });

  readonly estimatedPrepMinutes = computed(() => {
    const { calmMinutes, peakMinutes, interruptionMinutes } = this.formValue();
    if (calmMinutes == null || peakMinutes == null || interruptionMinutes == null) return null;
    if (calmMinutes < 0 || peakMinutes < 0 || interruptionMinutes < 0) return null;
    return estimatePrepMinutes(calmMinutes, peakMinutes, interruptionMinutes);
  });

  constructor() {
    this.prepTimeForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => {
      this.formValue.set({
        calmMinutes: v.calmMinutes ?? null,
        peakMinutes: v.peakMinutes ?? null,
        interruptionMinutes: v.interruptionMinutes ?? null,
      });
    });

    effect(() => {
      if (this.visible()) {
        const init = this.initialEstimate;
        this.prepTimeForm.setValue({
          calmMinutes: init ? init.calmMinutes : null,
          peakMinutes: init ? init.peakMinutes : null,
          interruptionMinutes: init ? init.interruptionMinutes : null,
        });
      }
    });
  }

  apply(): void {
    if (this.prepTimeForm.invalid) {
      this.prepTimeForm.markAllAsTouched();
      return;
    }
    const { calmMinutes, peakMinutes, interruptionMinutes } = this.prepTimeForm.value;
    const estimate: PrepTimeEstimate = {
      calmMinutes: calmMinutes ?? 0,
      peakMinutes: peakMinutes ?? 0,
      interruptionMinutes: interruptionMinutes ?? 0,
      estimatedPrepMinutes: this.estimatedPrepMinutes() ?? 0,
    };
    this.estimateApplied.emit(estimate);
    this.close();
  }

  close(): void {
    this.visible.set(false);
    this.visibleChange.emit(false);
  }
}
