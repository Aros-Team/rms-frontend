import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { RmsBadgeInputs } from './rms-badge.model';

@Component({
  selector: 'rms-badge',
  standalone: true,
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-badge.component.html',
  styles: [`
    :host {
      display: inline-block;
    }
  `],
})
export class RmsBadgeComponent {
  readonly label = input<string>('');
  readonly severity = input<RmsBadgeInputs['severity']>('info');
  readonly rounded = input<boolean>(false);
  readonly styleClass = input<string>('');

  readonly config = () => ({
    label: this.label(),
    severity: this.severity(),
    rounded: this.rounded(),
    styleClass: this.styleClass(),
  });
}
