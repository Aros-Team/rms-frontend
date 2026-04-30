
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { OrderService } from '@app/core/services/orders/order-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { OptionNamesPipe } from '@app/shared/pipes/option-names.pipe';
import { WebSocketService } from '@app/core/services/websocket/websocket.service';
import { AuthService } from '@app/core/services/authentication/auth-service';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-kitchen',
  imports: [RouterModule, OptionNamesPipe],
  templateUrl: './kitchen.html',
})
export class Kitchen implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private wsService = inject(WebSocketService);
  private authService = inject(AuthService);

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
      console.log('Kitchen: Polling already active');
      return;
    }
    console.log('Kitchen: Starting polling fallback (every 5 seconds)');
    // Polling cada 5 segundos como fallback
    this.pollingInterval = setInterval(() => {
      console.log('Kitchen: Polling for updates...');
      this.fetchAll(true); // silent refresh, sin parpadeo
    }, 5000);
  }

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) {
      console.error('Kitchen: No token available, falling back to polling');
      this.startPolling();
      return;
    }

    const baseUrl = environment.apiUrl.replace('/api', '');
    const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://') + '/ws';
    
    console.log('Kitchen: Attempting WebSocket connection to:', wsUrl);
    
    // Conectar (si ya está conectado, connect() lo ignora internamente)
    this.wsService.connect(wsUrl, token);

    // Suscribirse al estado de conexión — BehaviorSubject emite el estado actual inmediatamente
    const connectionSub = this.wsService.connection$.subscribe({
      next: (connected) => {
        console.log('Kitchen: WebSocket connection status:', connected);
        this.wsConnected.set(connected);
        
        if (!connected) {
          if (!this.pollingInterval) {
            console.warn('Kitchen: WebSocket disconnected, activating polling fallback');
            this.startPolling();
          }
        } else {
          if (this.pollingInterval) {
            console.log('Kitchen: WebSocket connected, stopping polling');
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
        console.log('Kitchen: Received orderCreated event:', order.id);
        this.queueOrders.update(list => {
          // Evitar duplicados
          if (list.some(o => o.id === order.id)) {
            console.log('Kitchen: Order', order.id, 'already in queue, skipping');
            return list;
          }
          console.log('Kitchen: Adding order', order.id, 'to queue');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(createdSub);

    // Suscribirse a órdenes en preparación (PREPARING)
    const preparingSub = this.wsService.orderPreparing$.subscribe({
      next: (order) => {
        console.log('Kitchen: Received orderPreparing event:', order.id);
        // Remover de cola y agregar a preparación
        this.queueOrders.update(list => list.filter(o => o.id !== order.id));
        this.preparingOrders.update(list => {
          if (list.some(o => o.id === order.id)) {
            console.log('Kitchen: Order', order.id, 'already in preparing, skipping');
            return list;
          }
          console.log('Kitchen: Moving order', order.id, 'to preparing');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(preparingSub);

    // Suscribirse a órdenes listas (READY)
    const readySub = this.wsService.orderReady$.subscribe({
      next: (order) => {
        console.log('Kitchen: Received orderReady event:', order.id);
        // Remover de preparación y agregar a listas
        this.preparingOrders.update(list => list.filter(o => o.id !== order.id));
        this.readyOrders.update(list => {
          if (list.some(o => o.id === order.id)) {
            console.log('Kitchen: Order', order.id, 'already in ready, skipping');
            return list;
          }
          console.log('Kitchen: Moving order', order.id, 'to ready');
          return [...list, order];
        });
      }
    });
    this.wsSubs.push(readySub);
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
      next: (order) => {
        this.queueOrders.update(list => list.filter(o => o.id !== order.id));
        this.preparingOrders.update(list => [...list, order]);
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
      next: (updated) => {
        this.preparingOrders.update(list => list.filter(o => o.id !== updated.id));
        this.readyOrders.update(list => [...list, updated]);
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
      next: (updated) => {
        this.readyOrders.update(list => list.filter(o => o.id !== updated.id));
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
