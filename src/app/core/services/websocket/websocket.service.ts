import { Injectable, inject, OnDestroy } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject, BehaviorSubject } from 'rxjs';

import { LoggingService } from '@app/core/services/logging/logging-service';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';

export interface WebSocketMessage<T = unknown> {
  destination: string;
  body: T;
}

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private logger = inject(LoggingService);
  private client?: Client;
  private connected = false;
  private subscriptions = new Map<string, StompSubscription>();

  private orderCreatedSubject = new Subject<OrderResponse>();
  private orderPreparingSubject = new Subject<OrderResponse>();
  private orderReadySubject = new Subject<OrderResponse>();
  // BehaviorSubject para que nuevos suscriptores reciban el estado actual inmediatamente
  private connectionSubject = new BehaviorSubject<boolean>(false);

  orderCreated$ = this.orderCreatedSubject.asObservable();
  orderPreparing$ = this.orderPreparingSubject.asObservable();
  orderReady$ = this.orderReadySubject.asObservable();
  connection$ = this.connectionSubject.asObservable();

  connect(wsUrl: string, token: string): void {
    if (this.connected) {
      this.logger.debug('WebSocket: Already connected');
      return;
    }

    if (this.client && this.client.active) {
      this.logger.debug('WebSocket: Client already active, skipping');
      return;
    }

    this.logger.info('WebSocket: Connecting to', wsUrl);
    console.log('WebSocket: Attempting connection with token:', token ? 'Present' : 'Missing');

    this.client = new Client({
      brokerURL: wsUrl,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        this.logger.debug('WebSocket STOMP:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      // Agregar timeout para detectar fallos más rápido
      connectionTimeout: 10000,
    });

    this.client.onConnect = (frame) => {
      this.connected = true;
      this.connectionSubject.next(true);
      this.logger.info('WebSocket: Connected successfully');
      console.log('WebSocket: Connection established', frame);
      this.subscribeToTopics();
    };

    this.client.onStompError = (frame) => {
      this.logger.error('WebSocket STOMP Error:', frame.headers['message'], frame.body);
      console.error('WebSocket STOMP Error:', frame);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onWebSocketError = (event) => {
      this.logger.error('WebSocket Error:', event);
      console.error('WebSocket connection error:', event);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onWebSocketClose = (event) => {
      this.logger.warn('WebSocket closed:', event.code, event.reason);
      console.warn('WebSocket closed:', event);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onDisconnect = () => {
      this.connected = false;
      this.connectionSubject.next(false);
      this.logger.info('WebSocket: Disconnected');
      console.log('WebSocket: Disconnected');
    };

    try {
      this.client.activate();
      console.log('WebSocket: Client activated');
    } catch (error) {
      this.logger.error('WebSocket: Failed to activate client', error);
      console.error('WebSocket: Activation error:', error);
      this.connected = false;
      this.connectionSubject.next(false);
    }
  }

  private subscribeToTopics(): void {
    if (!this.client) {
      console.error('WebSocket: Cannot subscribe, client is null');
      return;
    }

    console.log('WebSocket: Subscribing to topics...');

    // Subscribe to new orders (QUEUE)
    const createdSub = this.client.subscribe('/topic/orders/created', (message) => {
      try {
        const order: OrderResponse = JSON.parse(message.body);
        this.logger.info('WebSocket: New order created', order);
        console.log('WebSocket: Received /topic/orders/created:', order);
        this.orderCreatedSubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing created order', error);
        console.error('WebSocket: Parse error for created order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/created', createdSub);
    console.log('WebSocket: Subscribed to /topic/orders/created');

    // Subscribe to orders in preparation (PREPARING)
    const preparingSub = this.client.subscribe('/topic/orders/preparing', (message) => {
      try {
        const order: OrderResponse = JSON.parse(message.body);
        this.logger.info('WebSocket: Order preparing', order);
        console.log('WebSocket: Received /topic/orders/preparing:', order);
        this.orderPreparingSubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing preparing order', error);
        console.error('WebSocket: Parse error for preparing order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/preparing', preparingSub);
    console.log('WebSocket: Subscribed to /topic/orders/preparing');

    // Subscribe to ready orders (READY)
    const readySub = this.client.subscribe('/topic/orders/ready', (message) => {
      try {
        const order: OrderResponse = JSON.parse(message.body);
        this.logger.info('WebSocket: Order ready', order);
        console.log('WebSocket: Received /topic/orders/ready:', order);
        this.orderReadySubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing ready order', error);
        console.error('WebSocket: Parse error for ready order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/ready', readySub);
    console.log('WebSocket: Subscribed to /topic/orders/ready');
    
    console.log('WebSocket: All subscriptions completed');
  }

  disconnect(): void {
    if (this.client) {
      this.subscriptions.forEach((sub) => sub.unsubscribe());
      this.subscriptions.clear();
      this.client.deactivate();
      this.connected = false;
      this.connectionSubject.next(false);
      this.logger.info('WebSocket: Manually disconnected');
    }
  }

  /** Llamar solo cuando el componente se desmonta pero NO queremos destruir la conexión */
  unsubscribeComponent(): void {
    // No desconecta el cliente, solo limpia las suscripciones locales del componente
    // El cliente sigue activo para otros componentes o cuando se vuelva a navegar aquí
  }

  isConnected(): boolean {
    return this.connected;
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
