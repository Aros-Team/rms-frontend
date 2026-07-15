import { Injectable, inject } from '@angular/core';
import { share } from 'rxjs';

import { Auth } from '@app/core/services/auth/auth';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelectionWsPayload } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';
import { environment } from '@environments/environment';

const SPECIAL_SELECTIONS_UPDATED_TOPIC = '/topic/special-selections/updated';

@Injectable({ providedIn: 'root' })
export class SpecialSelectionsRealtime {
  private readonly auth = inject(Auth);
  private readonly ws = inject(WebSocket);

  readonly updates$ = this.ws
    .subscribeToTopic<SpecialSelectionWsPayload>(SPECIAL_SELECTIONS_UPDATED_TOPIC)
    .pipe(
      share({
        resetOnError: true,
        resetOnComplete: false,
        resetOnRefCountZero: false,
      }),
    );

  constructor() {
    const token = this.auth.getToken();
    if (token) {
      this.ws.connect(environment.wsUrl, token);
    }
  }
}
