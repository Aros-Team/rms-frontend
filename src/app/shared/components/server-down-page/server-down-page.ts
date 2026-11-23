import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ServerStatus } from '@core/services/server-status/server-status';
import { RmsButton } from '@app/shared/ui/button/button';

@Component({
  selector: 'app-server-down-page',
  templateUrl: './server-down-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RmsButton],
})
export class ServerDownPage {
  protected serverStatus = inject(ServerStatus);
}