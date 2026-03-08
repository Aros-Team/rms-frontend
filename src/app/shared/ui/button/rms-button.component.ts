import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { RmsButtonInputs } from './rms-button.model';

@Component({
  selector: 'rms-button',
  standalone: true,
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      [label]="options().label"
      [icon]="options().icon"
      [severity]="options().severity"
      [outlined]="options().outlined"
      [text]="options().text"
      [raised]="options().raised"
      [rounded]="options().rounded"
      [disabled]="options().disabled"
      [loading]="options().loading"
      [type]="options().type"
      [styleClass]="options().styleClass"
      [iconPos]="options().iconPos"
      (onClick)="onClick.emit($event)"
    />
  `,
})
export class RmsButtonComponent {
  readonly label = input<string>('');
  readonly icon = input<string>('');
  readonly severity = input<RmsButtonInputs['severity']>('primary');
  readonly outlined = input<boolean>(false);
  readonly text = input<boolean>(false);
  readonly raised = input<boolean>(false);
  readonly rounded = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly styleClass = input<string>('');
  readonly iconPos = input<'left' | 'right'>('left');

  readonly onClick = output<Event>();

  readonly options = () => ({
    label: this.label(),
    icon: this.icon(),
    severity: this.severity(),
    outlined: this.outlined(),
    text: this.text(),
    raised: this.raised(),
    rounded: this.rounded(),
    disabled: this.disabled(),
    loading: this.loading(),
    type: this.type(),
    styleClass: this.styleClass(),
    iconPos: this.iconPos(),
  });
}
