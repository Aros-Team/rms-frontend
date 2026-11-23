/**
 * Tests for the persistent header notification feed.
 *
 * Feature: one global feed backed by the API, updated in real time.
 * Contract:
 *  - `start` loads the persisted page and also subscribes to the WS topic;
 *  - a real-time notification is prepended once and increments the badge;
 *  - marking all as read clears the badge and persists the transition.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from '@app/core/services/websocket/websocket';
import { NOTIFICATIONS_TOPIC, NotificationCenter } from './notification-center';

const WIRE = {
  id: 41,
  code: 'ORDER_READY',
  severity: 'INFO',
  title: 'Pedido listo',
  message: 'Pedido #41 · Mesa 7 listo para servir',
  route: '/admin/orders',
  createdAt: '2026-11-22T20:00:00Z',
  read: false,
};

describe('NotificationCenter', () => {
  let center: NotificationCenter;
  let httpMock: HttpTestingController;
  let topic$: Subject<unknown>;
  const connect = vi.fn();

  beforeEach(() => {
    topic$ = new Subject<unknown>();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationCenter,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: WebSocket,
          useValue: {
            connect,
            subscribeToTopic: (topic: string) => {
              expect(topic).toBe(NOTIFICATIONS_TOPIC);
              return topic$;
            },
          },
        },
        {
          provide: Auth,
          useValue: { getToken: () => 'token' },
        },
        { provide: Logging, useValue: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } },
      ],
    });

    center = TestBed.inject(NotificationCenter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('loads the persisted feed and updates from the real-time topic', () => {
    center.start();
    httpMock.expectOne('v1/notifications?limit=50').flush({
      items: [],
      page: { limit: 50, offset: 0, total: 0 },
      unreadCount: 0,
    });

    topic$.next(WIRE);

    expect(connect).toHaveBeenCalledOnce();
    expect(center.notifications()).toHaveLength(1);
    expect(center.notifications()[0]?.icon).toBe('pi pi-check-circle');
    expect(center.notifications()[0]?.tone).toBe('success');
    expect(center.unreadCount()).toBe(1);
  });

  it('clears the badge and persists mark-all-read', () => {
    center.start();
    httpMock.expectOne('v1/notifications?limit=50').flush({
      items: [WIRE],
      page: { limit: 50, offset: 0, total: 1 },
      unreadCount: 1,
    });

    center.markAllRead();

    expect(center.unreadCount()).toBe(0);
    httpMock.expectOne('v1/notifications/read-all').flush(null);
  });

  it('does not duplicate a notification received twice', () => {
    center.start();
    httpMock.expectOne('v1/notifications?limit=50').flush({
      items: [],
      page: { limit: 50, offset: 0, total: 0 },
      unreadCount: 0,
    });

    topic$.next(WIRE);
    topic$.next(WIRE);

    expect(center.notifications()).toHaveLength(1);
    expect(center.unreadCount()).toBe(1);
  });
});
