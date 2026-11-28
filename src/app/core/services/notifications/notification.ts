import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { EMPTY, interval, Subscription } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { Order } from '@app/core/services/orders/order';
import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response';

@Injectable({ providedIn: 'root' })
export class Notification implements OnDestroy {
  private orderService = inject(Order);
  private logger = inject(Logging);

  private pollingSub?: Subscription;
  private readonly POLLING_INTERVAL = 15000;

  private seenOrderIds = signal<Set<number>>(new Set());
  unseenReadyOrders = signal<OrderResponse[]>([]);

  private audioContext: AudioContext | null = null;

  ngOnDestroy(): void {
    this.stopPolling();
  }

  startPolling(): void {
    if (this.pollingSub) return;

    this.pollingSub = interval(this.POLLING_INTERVAL)
      .pipe(
        // Bounded page walk: a READY order past the first page must still be
        // notified, and the walk stops at MAX_ORDER_PAGES instead of looping.
        switchMap(() =>
          this.orderService.getAllOrdersByStatus('READY').pipe(
            // A failed walk (e.g. a 5xx mid-way) must not kill the interval:
            // the next tick retries instead of silencing notifications forever.
            catchError((err: unknown) => {
              this.logger.error('Error polling READY orders', err);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe({
        next: (result) => {
          if (result.truncated) {
            this.logger.warn(
              `Notification: READY walk capped, notificando ${String(result.items.length)} de ${String(result.total)} pedidos`,
            );
          }
          this.processNewOrders(result.items);
        },
        error: (err) => {
          this.logger.error('Error polling READY orders', err);
        },
      });
  }

  stopPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = undefined;
  }

  private processNewOrders(orders: OrderResponse[]): void {
    const seen = this.seenOrderIds();
    const newOrders = orders.filter((o) => !seen.has(o.id));

    newOrders.forEach((order, index) => {
      setTimeout(() => {
        this.playNotification(order);
      }, index * 500);
    });

    if (newOrders.length > 0) {
      this.unseenReadyOrders.update((current) => [...current, ...newOrders]);
    }
  }

  // eslint-disable-next-line typescript/no-unused-vars
  private playNotification(_order: OrderResponse): void {
    this.playSound();
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }

  private playSound(): void {
    try {
      // eslint-disable-next-line typescript/no-unnecessary-condition
      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext ??= new AudioContextClass();

      const ctx = this.audioContext;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (err) {
      this.logger.error('Error playing notification sound', err);
    }
  }

  markAsSeen(orderId: number): void {
    this.seenOrderIds.update((ids) => {
      const newIds = new Set(ids);
      newIds.add(orderId);
      return newIds;
    });

    this.unseenReadyOrders.update((orders) => orders.filter((o) => o.id !== orderId));
  }

  markAllAsSeen(): void {
    const orders = this.unseenReadyOrders();
    orders.forEach((order) => {
      this.seenOrderIds.update((ids) => {
        const newIds = new Set(ids);
        newIds.add(order.id);
        return newIds;
      });
    });
    this.unseenReadyOrders.set([]);
  }

  clearSeenOrders(): void {
    this.seenOrderIds.set(new Set());
    this.unseenReadyOrders.set([]);
  }
}
