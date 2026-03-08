import { ChangeDetectionStrategy, Component, computed, input, output, signal, TemplateRef } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { RmsModalInputs } from './rms-modal.model';

@Component({
  selector: 'rms-modal',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, DialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rms-modal.component.html',
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class RmsModalComponent {
  readonly header = input<string>('');
  readonly visible = input<boolean>(false);
  readonly width = input<string>('500px');
  readonly styleClass = input<string>('');
  readonly closable = input<boolean>(true);
  readonly maskVisible = input<boolean>(true);
  readonly dismissableMask = input<boolean>(true);
  readonly closeOnEscape = input<boolean>(true);
  readonly footerTemplate = input<TemplateRef<any> | null>(null);

  readonly onClose = output<void>();

  readonly isVisible = signal(false);

  readonly config = () => ({
    header: this.header(),
    visible: this.visible(),
    width: this.width(),
    styleClass: this.styleClass(),
    closable: this.closable(),
    maskVisible: this.maskVisible(),
    dismissableMask: this.dismissableMask(),
    closeOnEscape: this.closeOnEscape(),
  });

  constructor() {
    computed(() => {
      this.isVisible.set(this.visible());
    });
  }
}
