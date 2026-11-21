import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ServerStatus } from '@core/services/server-status/server-status';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-server-down-page',
  templateUrl: './server-down-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule],
})
export class ServerDownPage {
  protected serverStatus = inject(ServerStatus);
}