import { Injectable, inject, OnDestroy } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import SockJS from 'sockjs-client';

import { Logging } from '@app/core/services/logging/logging';

export interface WebSocketMessage<T = unknown> {
  destination: string;
  body: T;
}

export interface CacheInvalidationEvent {
  resource: string;
  action: 'create' | 'update' | 'delete';
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class WebSocket implements OnDestroy {
  private logger = inject(Logging);
  private client?: Client;
  private connected = false;

  // Subjects keyed by topic — created on first subscription, shared across callers
  private topicSubjects = new Map<string, Subject<unknown>>();

  // STOMP subscriptions keyed by topic — one per topic regardless of how many
  // Angular subscribers are listening to the corresponding Subject
  private stompSubscriptions = new Map<string, StompSubscription>();

  // BehaviorSubject so new subscribers receive the current state immediately
  private connectionSubject = new BehaviorSubject<boolean>(false);
  connection$ = this.connectionSubject.asObservable();

  // Internal cache-invalidation channel (not tied to STOMP topics)
  private cacheInvalidationSubject = new Subject<CacheInvalidationEvent>();
  cacheInvalidation$ = this.cacheInvalidationSubject.asObservable();

  // ─── Public API ────────────────────────────────────────────────────────────

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
      this.logger.info('WebSocket: Connected successfully', frame);

      // Re-subscribe any topics that were registered before the connection was
      // established (or after a reconnect).
      this.resubscribeAll();
    };

    this.client.onStompError = (frame) => {
      this.logger.error('WebSocket STOMP Error:', frame.headers['message'], frame.body);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onWebSocketError = (event) => {
      this.logger.error('WebSocket Error:', event);
      this.connected = false;
      this.connectionSubject.next(false);
    };

    this.client.onWebSocketClose = (event) => {
      const closeEvent = event as { code?: number; reason?: string };
      this.logger.warn('WebSocket closed:', closeEvent.code, closeEvent.reason);
      this.connected = false;
      this.connectionSubject.next(false);
      // Clear STOMP subscriptions — they will be re-created on reconnect via resubscribeAll()
      this.stompSubscriptions.clear();
    };

    this.client.onDisconnect = () => {
      this.connected = false;
      this.connectionSubject.next(false);
      this.logger.info('WebSocket: Disconnected');
    };

    try {
      this.client.activate();
    } catch (error) {
      this.logger.error('WebSocket: Failed to activate client', error);
      this.connected = false;
      this.connectionSubject.next(false);
    }
  }

  /**
   * Returns a typed Observable for the given STOMP topic.
   *
   * - The STOMP subscription is created lazily when the first Angular subscriber
   *   arrives (or immediately if already connected) and is shared across all
   *   callers for the same topic.
   * - When the last Angular subscriber unsubscribes, the underlying STOMP
   *   subscription is torn down so the broker stops sending messages for that
   *   topic to this client.
   *
   * Components should unsubscribe from the returned Observable in ngOnDestroy
   * (or use takeUntilDestroyed / async pipe).
   */
  subscribeToTopic<T = unknown>(topic: string): Observable<T> {
    if (!this.topicSubjects.has(topic)) {
      this.topicSubjects.set(topic, new Subject<unknown>());
    }

    const subject = this.topicSubjects.get(topic)!;

    // If already connected and not yet subscribed via STOMP, do it now
    if (this.connected && !this.stompSubscriptions.has(topic)) {
      this.createStompSubscription(topic, subject);
    }

    return new Observable<T>((observer) => {
      const sub = subject.subscribe({
        next: (value) => { observer.next(value as T); },
        error: (err: unknown) => { observer.error(err); },
        complete: () => { observer.complete(); },
      });

      return () => {
        sub.unsubscribe();

        // If no more observers are listening to this topic, tear down the STOMP
        // subscription to stop receiving messages from the broker.
        if (!subject.observed) {
          this.destroyStompSubscription(topic);
        }
      };
    });
  }

  disconnect(): void {
    if (this.client) {
      this.stompSubscriptions.forEach((sub) => { sub.unsubscribe(); });
      this.stompSubscriptions.clear();
      this.client.deactivate();
      this.connected = false;
      this.connectionSubject.next(false);
      this.logger.info('WebSocket: Manually disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Emits a cache-invalidation event so other services can refresh their data.
   * This is an internal pub/sub channel — it does NOT send anything to the broker.
   */
  emitCacheInvalidation(resource: string, action: 'create' | 'update' | 'delete', id?: number): void {
    this.cacheInvalidationSubject.next({ resource, action, id });
    this.logger.debug('WebSocket: Cache invalidation emitted', { resource, action, id });
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.topicSubjects.forEach((subject) => { subject.complete(); });
    this.topicSubjects.clear();
    this.cacheInvalidationSubject.complete();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Called after every successful (re)connect to restore active topic subscriptions. */
  private resubscribeAll(): void {
    this.topicSubjects.forEach((subject, topic) => {
      // Only subscribe if someone is still listening
      if (subject.observed && !this.stompSubscriptions.has(topic)) {
        this.createStompSubscription(topic, subject);
      }
    });
  }

  private createStompSubscription(topic: string, subject: Subject<unknown>): void {
    if (!this.client) return;

    const stompSub = this.client.subscribe(topic, (message) => {
      try {
        const parsed: unknown = JSON.parse(message.body);
        subject.next(parsed);
      } catch (error) {
        this.logger.error(`WebSocket: Error parsing message on ${topic}`, error);
      }
    });

    this.stompSubscriptions.set(topic, stompSub);
    this.logger.debug(`WebSocket: Subscribed to ${topic}`);
  }

  private destroyStompSubscription(topic: string): void {
    const stompSub = this.stompSubscriptions.get(topic);
    if (stompSub) {
      stompSub.unsubscribe();
      this.stompSubscriptions.delete(topic);
      this.logger.debug(`WebSocket: Unsubscribed from ${topic}`);
    }
  }
}
