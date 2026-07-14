import { Component, inject, computed, DestroyRef, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval } from 'rxjs';

import { ButtonModule } from 'primeng/button';

import { SpecialSelectionsCacheService } from '@app/core/services/special-selections/special-selections-cache.service';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { SpecialSelectionWsPayload } from '@app/shared/models/dto/special-selections/special-selection-ws-payload';

@Component({
  selector: 'app-combos-waiter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './combos.html',
  styleUrl: './combos.css',
  imports: [ButtonModule],
})
export class Combos {
  private cache = inject(SpecialSelectionsCacheService);
  private ws = inject(WebSocket);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  combos = computed(() => this.cache.availableNow.data() ?? []);
  loading = computed(() => this.cache.availableNow.isLoading());

  currencyFormat = Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

  constructor() {
    this.cache.availableNow.load();

    this.ws.subscribeToTopic<SpecialSelectionWsPayload>('/topic/special-selections/updated')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cache.availableNow.refresh();
      });

    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.cache.availableNow.refresh();
      });
  }

  selectCombo(id: number): void {
    void this.router.navigate(['/worker/waiter/combos', id]);
  }
}
