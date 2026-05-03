import { Injectable, inject, OnDestroy } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Subject, BehaviorSubject } from 'rxjs';

import { Logging } from '@app/core/services/logging/logging';
import { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';
import { InventoryStockUpdatedEvent } from '@models/dto/inventory/inventory-stock-update';

// SockJS is loaded as a global script (UMD build) via angular.json scripts array
declare const SockJS: new (url: string) => WebSocket;

export interface WebSocketMessage<T = unknown> {
  destination: string;
  body: T;
}

@Injectable({ providedIn: 'root' })
export class WebSocket implements OnDestroy {
  private logger = inject(Logging);
  private client?: Client;
  private connected = false;
  private subscriptions = new Map<string, StompSubscription>();

  private orderCreatedSubject = new Subject<OrderResponse>();
  private orderPreparingSubject = new Subject<OrderResponse>();
  private orderReadySubject = new Subject<OrderResponse>();
  private orderDeliveredSubject = new Subject<OrderResponse>();
  private inventoryUpdatedSubject = new Subject<InventoryStockUpdatedEvent>();
  // BehaviorSubject para que nuevos suscriptores reciban el estado actual inmediatamente
  private connectionSubject = new BehaviorSubject<boolean>(false);

  orderCreated$ = this.orderCreatedSubject.asObservable();
  orderPreparing$ = this.orderPreparingSubject.asObservable();
  orderReady$ = this.orderReadySubject.asObservable();
  orderDelivered$ = this.orderDeliveredSubject.asObservable();
  inventoryUpdated$ = this.inventoryUpdatedSubject.asObservable();
  connection$ = this.connectionSubject.asObservable();

  connect(wsUrl: string, token: string): void {
    if (this.connected) {
      this.logger.debug('WebSocket: Already connected');
      return;
    }

    if (this.client?.active) {
      this.logger.debug('WebSocket: Client already active, skipping');
      return;
    }

    this.logger.info('WebSocket: Connecting to', wsUrl);
    this.logger.debug('WebSocket: Attempting connection with token:', token ? 'Present' : 'Missing');

    this.client = new Client({
      // Use SockJS as transport factory — required by Spring Boot's SockJS endpoint
      webSocketFactory: () => new SockJS(wsUrl),
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      debug: (str) => {
        this.logger.debug('WebSocket STOMP:', str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      connectionTimeout: 10000,
    });

    this.client.onConnect = (frame) => {
      this.connected = true;
      this.connectionSubject.next(true);
      this.logger.info('WebSocket: Connected successfully');
      this.logger.debug('WebSocket: Connection established', frame);
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
      const closeEvent = event as { code?: number; reason?: string };
      this.logger.warn('WebSocket closed:', closeEvent.code, closeEvent.reason);
      console.warn('WebSocket closed:', event);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onDisconnect = () => {
      this.connected = false;
      this.connectionSubject.next(false);
      this.logger.info('WebSocket: Disconnected');
      this.logger.debug('WebSocket: Disconnected');
    };

    try {
      this.client.activate();
      this.logger.debug('WebSocket: Client activated');
    } catch (error) {
      this.logger.error('WebSocket: Failed to activate client', error);
      console.error('WebSocket: Activation error:', error);
      this.connected = false;
      this.connectionSubject.next(false);
    }
  }

  private subscribeToTopics(): void {
    if (!this.client) {
      this.logger.debug('WebSocket: Cannot subscribe, client is null');
      return;
    }

      this.logger.debug('WebSocket: Subscribing to topics...');

    // Subscribe to new orders (QUEUE)
    const createdSub = this.client.subscribe('/topic/orders/created', (message) => {
      try {
        const order = JSON.parse(message.body) as OrderResponse;
        this.logger.info('WebSocket: New order created', order);
        this.logger.debug('WebSocket: Received /topic/orders/created:', order);
        this.orderCreatedSubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing created order', error);
        console.error('WebSocket: Parse error for created order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/created', createdSub);
    this.logger.debug('WebSocket: Subscribed to /topic/orders/created');

    // Subscribe to orders in preparation (PREPARING)
    const preparingSub = this.client.subscribe('/topic/orders/preparing', (message) => {
      try {
        const order = JSON.parse(message.body) as OrderResponse;
        this.logger.info('WebSocket: Order preparing', order);
        this.logger.debug('WebSocket: Received /topic/orders/preparing:', order);
        this.orderPreparingSubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing preparing order', error);
        console.error('WebSocket: Parse error for preparing order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/preparing', preparingSub);
    this.logger.debug('WebSocket: Subscribed to /topic/orders/preparing');

    // Subscribe to ready orders (READY)
    const readySub = this.client.subscribe('/topic/orders/ready', (message) => {
      try {
        const order = JSON.parse(message.body) as OrderResponse;
        this.logger.info('WebSocket: Order ready', order);
        this.logger.debug('WebSocket: Received /topic/orders/ready:', order);
        this.orderReadySubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing ready order', error);
        console.error('WebSocket: Parse error for ready order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/ready', readySub);
    this.logger.debug('WebSocket: Subscribed to /topic/orders/ready');

    // Subscribe to inventory stock updates
    const inventorySub = this.client.subscribe('/topic/inventory/updates', (message) => {
      try {
        const event = JSON.parse(message.body) as InventoryStockUpdatedEvent;
        this.logger.info('WebSocket: Inventory stock updated', event);
        this.inventoryUpdatedSubject.next(event);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing inventory update', error);
      }
    });
    this.subscriptions.set('/topic/inventory/updates', inventorySub);
    this.logger.debug('WebSocket: Subscribed to /topic/inventory/updates');

    // Subscribe to delivered orders (DELIVERED)
    const deliveredSub = this.client.subscribe('/topic/orders/delivered', (message) => {
      try {
        const order = JSON.parse(message.body) as OrderResponse;
        this.logger.info('WebSocket: Order delivered', order);
        this.logger.debug('WebSocket: Received /topic/orders/delivered:', order);
        this.orderDeliveredSubject.next(order);
      } catch (error) {
        this.logger.error('WebSocket: Error parsing delivered order', error);
        console.error('WebSocket: Parse error for delivered order:', error);
      }
    });
    this.subscriptions.set('/topic/orders/delivered', deliveredSub);
    this.logger.debug('WebSocket: Subscribed to /topic/orders/delivered');

    this.logger.debug('WebSocket: All subscriptions completed');
  }

  disconnect(): void {
    if (this.client) {
      this.subscriptions.forEach((sub) => { sub.unsubscribe(); });
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