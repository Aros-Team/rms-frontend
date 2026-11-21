import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ServerStatus } from '@core/services/server-status/server-status';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-server-down-banner',
  templateUrl: './server-down-banner.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class ServerDownBanner {
  protected serverStatus = inject(ServerStatus);
}