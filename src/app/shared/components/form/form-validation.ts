import { Component, Input, OnInit, inject } from "@angular/core";
import { ControlContainer, FormGroup, FormGroupDirective } from "@angular/forms";

@Component({
  selector: 'app-form-validation',
  templateUrl: './form-validation.html',
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
})
export class FormValidation implements OnInit {
  form!: FormGroup;
  @Input({ required: true }) field!: string;
  @Input() backendError?: string;

  private parentFormGroup = inject(FormGroupDirective);
  
  ngOnInit(): void {
    this.form = this.parentFormGroup.form;
  }
}
