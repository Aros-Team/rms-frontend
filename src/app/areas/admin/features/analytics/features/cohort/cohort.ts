import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-analytics-cohort',
  imports: [CommonModule, MessageModule],
  template: `
    <div class="p-4">
      <p-message severity="warn" text="Esta funcionalidad ya no está disponible. Los datos de cohorte han sido removidos del backend." />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class Cohort {}
