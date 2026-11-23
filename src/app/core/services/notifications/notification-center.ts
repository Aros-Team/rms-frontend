import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { environment } from '@environments/environment';
import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';

export type NotificationTone = 'accent' | 'success' | 'warning' | 'danger';
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

/**
 * One item in the header notification feed.
 *
 * The feed is persisted server-side and shared by every admin session. The
 * wire shape is `NotificationView`; the UI-only icon and tone are derived from
 * the stable notification code and severity.
 */
export interface AppNotification {
  readonly id: number;
  readonly code: string;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly message: string;
  readonly createdAt: Date;
  readonly read: boolean;
  readonly icon: string;
  readonly tone: NotificationTone;
  readonly route?: string;
}

interface NotificationWire {
  id: number;
  code: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  route: string | null;
  createdAt: string;
  read: boolean;
}

interface NotificationPageWire {
  items: NotificationWire[];
  page: { limit: number; offset: number; total: number };
  unreadCount: number;
}

export const NOTIFICATIONS_TOPIC = '/topic/notifications';

const ICONS: Record<string, string> = {
  ORDER_CREATED: 'pi pi-shopping-cart',
  ORDER_READY: 'pi pi-check-circle',
  ORDER_CANCELLED: 'pi pi-ban',
  ANALYTICS_ALERT: 'pi pi-chart-bar',
  BUSINESS_RULE_VIOLATED: 'pi pi-exclamation-triangle',
  WORKER_CLOCK_IN: 'pi pi-sign-in',
  WORKER_LATE: 'pi pi-clock',
};

const READY_CODES = new Set(['ORDER_READY']);

function toneFor(code: string, severity: NotificationSeverity): NotificationTone {
  if (READY_CODES.has(code)) return 'success';
  switch (severity) {
    case 'CRITICAL':
      return 'danger';
    case 'WARNING':
      return 'warning';
    default:
      return 'accent';
  }
}

function toItem(wire: NotificationWire): AppNotification {
  return {
    id: wire.id,
    code: wire.code,
    severity: wire.severity,
    title: wire.title,
    message: wire.message,
    createdAt: new Date(wire.createdAt),
    read: wire.read,
    icon: ICONS[wire.code] ?? 'pi pi-bell',
    tone: toneFor(wire.code, wire.severity),
    route: wire.route ?? undefined,
  };
}

/**
 * Central, persistent notification feed for the application chrome.
 *
 * Feature: "agrupa todas las notificaciones" in one global place.
 * Contract:
 *  - the initial/historical feed and read state come from
 *    `GET /api/v1/notifications`;
 *  - real-time arrivals come from the API's `/topic/notifications` topic, so
 *    the badge updates without polling;
 *  - mark-read / mark-all / clear are optimistic locally and persisted through
 *    the API; a failed write triggers a refresh instead of a stale badge.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenter implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly ws = inject(WebSocket);
  private readonly auth = inject(Auth);
  private readonly logger = inject(Logging);

  private readonly items = signal<AppNotification[]>([]);
  private readonly unread = signal(0);
  private readonly subscriptions: Subscription[] = [];
  private started = false;

  readonly notifications = this.items.asReadonly();
  readonly unreadCount = computed(() => this.unread());

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();

    const token = this.auth.getToken();
    if (!token) {
      this.logger.warn('Notification center: no session token, real-time feed disabled');
      return;
    }

    this.ws.connect(environment.wsUrl, token);
    this.subscriptions.push(
      this.ws.subscribeToTopic<NotificationWire>(NOTIFICATIONS_TOPIC).subscribe({
        next: (wire) => {
          this.receive(wire);
        },
        error: (err: unknown) => {
          this.logger.error('Notification center: real-time feed error', err);
        },
      }),
    );
  }

  /** Reloads the persisted feed (used when the panel opens). */
  refresh(): void {
    this.http.get<NotificationPageWire>('v1/notifications', { params: { limit: 50 } }).subscribe({
      next: (page) => {
        this.items.set(page.items.map(toItem));
        this.unread.set(page.unreadCount);
      },
      error: (err: unknown) => {
        this.logger.error('Notification center: failed to load feed', err);
      },
    });
  }

  markRead(id: number): void {
    const target = this.items().find((item) => item.id === id);
    if (target && !target.read) {
      this.items.update((items) =>
        items.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      this.unread.update((count) => Math.max(0, count - 1));
    }

    this.http.patch(`v1/notifications/${String(id)}/read`, null).subscribe({
      error: (err: unknown) => {
        this.logger.error('Notification center: failed to mark read', err);
        this.refresh();
      },
    });
  }

  markAllRead(): void {
    this.items.update((items) => items.map((item) => ({ ...item, read: true })));
    this.unread.set(0);

    this.http.post('v1/notifications/read-all', null).subscribe({
      error: (err: unknown) => {
        this.logger.error('Notification center: failed to mark all read', err);
        this.refresh();
      },
    });
  }

  clear(): void {
    this.items.set([]);
    this.unread.set(0);

    this.http.delete('v1/notifications').subscribe({
      error: (err: unknown) => {
        this.logger.error('Notification center: failed to clear feed', err);
        this.refresh();
      },
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.length = 0;
  }

  private receive(wire: NotificationWire): void {
    if (this.items().some((item) => item.id === wire.id)) return;

    const item = toItem(wire);
    this.items.update((items) => [item, ...items].slice(0, 50));
    if (!item.read) {
      this.unread.update((count) => count + 1);
    }
  }
}
