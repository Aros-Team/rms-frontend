
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { Order } from '@app/core/services/orders/order';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OptionNamesPipe } from '@app/shared/pipes/option-names.pipe';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-kitchen',
  imports: [RouterModule, OptionNamesPipe],
  templateUrl: './kitchen.html',
})
export class Kitchen implements OnInit, OnDestroy {
  private orderService = inject(Order);
  private wsService = inject(WebSocket);
  private authService = inject(Auth);
  private logger = inject(Logging);

  loading = signal(true);       // solo para carga inicial
  refreshing = signal(false);   // para actualizaciones silenciosas
  error = signal<string | null>(null);
  wsConnected = signal(false);

  queueOrders    = signal<OrderResponse[]>([]);
  preparingOrders = signal<OrderResponse[]>([]);
  readyOrders    = signal<OrderResponse[]>([]);

  processing = new Set<number>();
  preparingNext = signal(false);

  private wsSubs: Subscription[] = [];
  private pollingInterval?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.fetchAll();
    this.connectWebSocket();
  }

  ngOnDestroy(): void {
    // Solo desuscribir los observables locales, NO desconectar el WebSocket
    // El servicio es singleton y puede ser usado por otros componentes
    this.wsSubs.forEach(sub => sub.unsubscribe());
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) {
      this.logger.debug('Kitchen: Polling already active');
      return;
    }
    this.logger.debug('Kitchen: Starting polling fallback (every 5 seconds)');
    // Polling cada 5 segundos como fallback
    this.pollingInterval = setInterval(() => {
      this.logger.debug('Kitchen: Polling for updates...');
      this.fetchAll(true); // silent refresh, sin parpadeo
    }, 5000);
  }

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.logger.debug('Kitchen: No token available, falling back to polling');
      this.startPolling();
      return;
    }

    this.logger.debug('Kitchen: Attempting WebSocket connection to:', environment.wsUrl);
    
    // Conectar (si ya está conectado, connect() lo ignora internamente)
    this.wsService.connect(environment.wsUrl, token);

    // Suscribirse al estado de conexión — BehaviorSubject emite el estado actual inmediatamente
    const connectionSub = this.wsService.connection$.subscribe({
      next: (connected) => {
        this.logger.debug('Kitchen: WebSocket connection status:', connected);
        this.wsConnected.set(connected);
        
        if (!connected) {
          if (!this.pollingInterval) {
            this.logger.warn('Kitchen: WebSocket disconnected, activating polling fallback');
            this.startPolling();
          }
        } else {
          if (this.pollingInterval) {
            this.logger.debug('Kitchen: WebSocket connected, stopping polling');
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
          }
          if (this.error()?.includes('WebSocket')) {
            this.error.set(null);
          }
        }
      }
    });
    this.wsSubs.push(connectionSub);

    // Suscribirse a nuevas órdenes (QUEUE)
    const createdSub = this.wsService.orderCreated$.subscribe({
      next: (order) => {
        this.logger.debug('Kitchen: Received orderCreated event:', order.id);
        this.queueOrders.update(list => {
          // Evitar duplicados
          if (list.some(o => o.id === order.id)) {
            this.logger.debug('Kitchen: Order', order.id, 'already in queue, skipping');
            return list;
          }
          this.logger.debug('Kitchen: Adding order', order.id, 'to queue');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(createdSub);

    // Suscribirse a órdenes en preparación (PREPARING)
    const preparingSub = this.wsService.orderPreparing$.subscribe({
      next: (order) => {
        this.logger.debug('Kitchen: Received orderPreparing event:', order.id);
        // Clear preparingNext flag in case the WS arrives before the HTTP response
        this.preparingNext.set(false);
        // Remover de cola y agregar a preparación
        this.queueOrders.update(list => list.filter(o => o.id !== order.id));
        this.preparingOrders.update(list => {
          if (list.some(o => o.id === order.id)) {
            this.logger.debug('Kitchen: Order', order.id, 'already in preparing, skipping');
            return list;
          }
          this.logger.debug('Kitchen: Moving order', order.id, 'to preparing');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(preparingSub);

    // Suscribirse a órdenes listas (READY)
    const readySub = this.wsService.orderReady$.subscribe({
      next: (order) => {
        this.logger.debug('Kitchen: Received orderReady event:', order.id);
        // Also clear processing flag in case the WS arrives before the HTTP response
        this.processing.delete(order.id);
        // Remover de preparación y agregar a listas
        this.preparingOrders.update(list => list.filter(o => o.id !== order.id));
        this.readyOrders.update(list => {
          if (list.some(o => o.id === order.id)) {
            this.logger.debug('Kitchen: Order', order.id, 'already in ready, skipping');
            return list;
          }
          this.logger.debug('Kitchen: Moving order', order.id, 'to ready');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(readySub);

    // Suscribirse a órdenes entregadas (DELIVERED)
    const deliveredSub = this.wsService.orderDelivered$.subscribe({
      next: (order) => {
        this.logger.debug('Kitchen: Received orderDelivered event:', order.id);
        // Clear processing flag and remove from readyOrders on ALL devices
        this.processing.delete(order.id);
        this.readyOrders.update(list => list.filter(o => o.id !== order.id));
      }
    });
    this.wsSubs.push(deliveredSub);
  }

  fetchAll(silent = false): void {
    if (silent) {
      this.refreshing.set(true);
    } else {
      this.loading.set(true);
    }
    this.error.set(null);

    let done = 0;
    const check = () => {
      if (++done === 3) {
        this.loading.set(false);
        this.refreshing.set(false);
      }
    };

    this.orderService.getOrdersByStatus('QUEUE').subscribe({
      next: v => { this.queueOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando cola.'); check(); }
    });

    this.orderService.getOrdersByStatus('PREPARING').subscribe({
      next: v => { this.preparingOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando preparación.'); check(); }
    });

    this.orderService.getOrdersByStatus('READY').subscribe({
      next: v => { this.readyOrders.set(v); check(); },
      error: () => { this.error.set('Error cargando listas.'); check(); }
    });
  }

  prepareNext(): void {
    if (this.preparingNext()) return;
    this.preparingNext.set(true);
    this.error.set(null);

    this.orderService.prepareNext().subscribe({
      next: () => {
        // Do NOT update state locally — the WebSocket event (orderPreparing$) will
        // broadcast to ALL connected clients including this one, avoiding duplicates.
        this.preparingNext.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message || 'No hay órdenes en cola.';
        this.error.set(msg);
        this.preparingNext.set(false);
      }
    });
  }

  markReady(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);
    this.error.set(null);

    this.orderService.markAsReady(order.id).subscribe({
      next: () => {
        // Clear the processing flag so the spinner stops on THIS device.
        // The WebSocket event (orderReady$) will move the order to readyOrders
        // on ALL connected devices including this one.
        this.processing.delete(order.id);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo marcar como lista.');
        this.processing.delete(order.id);
      }
    });
  }

  deliver(order: OrderResponse): void {
    if (this.processing.has(order.id)) return;
    this.processing.add(order.id);
    this.error.set(null);

    this.orderService.deliverOrder(order.id).subscribe({
      next: () => {
        // Remove locally immediately for the device that triggered the action.
        // The WebSocket event (orderDelivered$) will also remove it on ALL other
        // connected devices. If the backend emits /topic/orders/delivered, all
        // devices sync automatically. If not, only this device updates locally.
        this.readyOrders.update(list => list.filter(o => o.id !== order.id));
        this.processing.delete(order.id);
      },
      error: (err) => {
        this.error.set(err?.error?.message || 'No se pudo entregar la orden.');
        this.processing.delete(order.id);
      }
    });
  }

  isProcessing(id: number): boolean {
    return this.processing.has(id);
  }

  orderTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  totalItems(order: OrderResponse): number {
    return order.details?.length ?? 0;
  }
}
