import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SkeletonModule } from 'primeng/skeleton';
import { RmsSkeletonInputs } from './rms-skeleton.model';

@Component({
  selector: 'rms-skeleton',
  standalone: true,
  imports: [SkeletonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-skeleton.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class RmsSkeletonComponent {
  readonly variant = input<RmsSkeletonInputs['variant']>('rectangle');
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
  readonly borderRadius = input<string>('0.5rem');
  readonly animation = input<RmsSkeletonInputs['animation']>('wave');
  readonly styleClass = input<string>('');

  readonly config = () => ({
    variant: this.variant(),
    width: this.width(),
    height: this.height(),
    borderRadius: this.borderRadius(),
    animation: this.animation(),
    styleClass: this.styleClass(),
  });
}
