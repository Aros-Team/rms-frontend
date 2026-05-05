import { Injectable, inject, OnDestroy } from '@angular/core';
import { Client, StompSubscription } from '@stomp/stompjs';
import { Observable, Subject, BehaviorSubject, share } from 'rxjs';
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

  // Subjects keyed by topic — one Subject per topic, receives raw STOMP messages
  private topicSubjects = new Map<string, Subject<unknown>>();

  // Shared observables keyed by topic — derived from topicSubjects via share().
  // All Angular subscribers for the same topic consume a single multicast stream;
  // the underlying STOMP subscription is torn down when the ref-count drops to zero.
  private topicObservables = new Map<string, Observable<unknown>>();

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
   * Returns a typed, multicasted Observable for the given STOMP topic.
   *
   * Sharing semantics (via share):
   * - A single STOMP subscription is created for each topic, regardless of how
   *   many Angular components subscribe to the returned Observable.
   * - When the ref-count drops to zero (all components unsubscribed), the STOMP
   *   subscription is torn down so the broker stops sending messages for that
   *   topic to this client.
   * - No replay buffer — late subscribers only receive future messages, which
   *   prevents stale events from being re-processed on component re-mount.
   *
   * Components should unsubscribe in ngOnDestroy (or use takeUntilDestroyed /
   * async pipe).
   */
  subscribeToTopic<T = unknown>(topic: string): Observable<T> {
    if (!this.topicObservables.has(topic)) {
      const subject = new Subject<unknown>();
      this.topicSubjects.set(topic, subject);

      const shared = subject.pipe(
        share({
          resetOnRefCountZero: () => new Observable((observer) => {
            // Teardown: destroy the STOMP subscription when no one is listening
            this.destroyStompSubscription(topic);
            observer.complete();
          }),
        }),
      );

      this.topicObservables.set(topic, shared);
    }

    // If already connected and not yet subscribed via STOMP, do it now.
    // (If not connected yet, resubscribeAll() will handle it on onConnect.)
    const subject = this.topicSubjects.get(topic);
    if (subject && this.connected && !this.stompSubscriptions.has(topic)) {
      this.createStompSubscription(topic, subject);
    }

    return this.topicObservables.get(topic) as Observable<T>;
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
    this.topicObservables.clear();
    this.cacheInvalidationSubject.complete();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Called after every successful (re)connect to restore active topic subscriptions. */
  private resubscribeAll(): void {
    this.topicSubjects.forEach((subject, topic) => {
      // Only create a STOMP subscription if the shared Observable has active observers
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
