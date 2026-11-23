/**
 * Tests for the lazy SockJS loading in `WebSocket`.
 *
 * Contract:
 *  - `sockjs-client` is only touched when `connect()` runs, never on service
 *    creation, so screens that merely inject the service do not pull the chunk;
 *  - `connect()` keeps returning `void` synchronously;
 *  - concurrent `connect()` calls share one import and one client;
 *  - `disconnect()` while the import is unresolved prevents client creation.
 */
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from './websocket';

interface FakeClientConfig {
  webSocketFactory: () => unknown;
  connectHeaders?: Record<string, string>;
}

const sockJs = vi.hoisted(() => {
  function fakeSockJs(url: string): { url: string; kind: string } {
    return { url, kind: 'sockjs' };
  }
  return { factory: vi.fn(fakeSockJs) };
});

const stomp = vi.hoisted(() => {
  const instances: FakeStompClient[] = [];

  class FakeStompClient {
    active = false;
    socket: unknown = null;
    config: FakeClientConfig;
    onConnect?: (frame: unknown) => void;

    constructor(config: FakeClientConfig) {
      this.config = config;
      instances.push(this);
    }

    activate(): void {
      this.active = true;
      this.socket = this.config.webSocketFactory();
    }

    deactivate(): void {
      this.active = false;
    }

    subscribe(): { unsubscribe: () => void } {
      return { unsubscribe: () => undefined };
    }
  }

  return { FakeStompClient, instances };
});

vi.mock('sockjs-client', () => ({ default: sockJs.factory }));
vi.mock('@stomp/stompjs', () => ({ Client: stomp.FakeStompClient }));

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('WebSocket lazy SockJS import', () => {
  let service: WebSocket;

  // The Vite module runner resolves dynamic imports over one or more macrotasks
  // (the stale-attempt case starts two loads), so wait a bounded number of ticks.
  const flushAsyncWork = async (): Promise<void> => {
    for (let tick = 0; tick < 5; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.resolve();
  };

  beforeEach(() => {
    sockJs.factory.mockClear();
    stomp.instances.length = 0;
    logger.debug.mockClear();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();

    TestBed.configureTestingModule({
      providers: [{ provide: Logging, useValue: logger }],
    });
    service = TestBed.inject(WebSocket);
  });

  it('does not touch SockJS until connect() is called', async () => {
    expect(sockJs.factory).not.toHaveBeenCalled();
    await flushAsyncWork();
    expect(sockJs.factory).not.toHaveBeenCalled();
    expect(stomp.instances).toHaveLength(0);
  });

  it('returns void synchronously and imports SockJS after connect()', async () => {
    expectTypeOf<typeof service.connect>().returns.toBeVoid();

    service.connect('http://localhost:8080/ws', 'token-123');

    // Nothing is imported nor constructed during the synchronous call.
    expect(sockJs.factory).not.toHaveBeenCalled();
    expect(stomp.instances).toHaveLength(0);

    await flushAsyncWork();

    expect(sockJs.factory).toHaveBeenCalledTimes(1);
    expect(stomp.instances).toHaveLength(1);
    expect(stomp.instances[0].config).toMatchObject({
      connectHeaders: { Authorization: 'Bearer token-123' },
    });
    expect(stomp.instances[0].active).toBe(true);
    expect(stomp.instances[0].socket).toEqual({
      url: 'http://localhost:8080/ws',
      kind: 'sockjs',
    });
  });

  it('coalesces rapid connect() calls into a single import and client', async () => {
    service.connect('http://localhost:8080/ws', 'token-123');
    service.connect('http://localhost:8080/ws', 'token-123');

    await flushAsyncWork();

    expect(sockJs.factory).toHaveBeenCalledTimes(1);
    expect(stomp.instances).toHaveLength(1);
  });

  it('skips the import when a client is already active', async () => {
    service.connect('http://localhost:8080/ws', 'token-123');
    await flushAsyncWork();
    sockJs.factory.mockClear();

    service.connect('http://localhost:8080/ws', 'token-123');
    await flushAsyncWork();

    expect(sockJs.factory).not.toHaveBeenCalled();
    expect(stomp.instances).toHaveLength(1);
  });

  it('does not create a client when disconnect() runs while the import is in flight', async () => {
    service.connect('http://localhost:8080/ws', 'token-123');
    service.disconnect();

    await flushAsyncWork();

    expect(stomp.instances).toHaveLength(0);
    expect(sockJs.factory).not.toHaveBeenCalled();
  });

  it('allows a retry after disconnect() cancelled a pending import', async () => {
    service.connect('http://localhost:8080/ws', 'token-123');
    service.disconnect();
    await flushAsyncWork();

    service.connect('http://localhost:8080/ws', 'token-123');
    await flushAsyncWork();

    expect(stomp.instances).toHaveLength(1);
    expect(sockJs.factory).toHaveBeenCalledTimes(1);
  });

  it('ignores the stale import when a new connect() follows a disconnect()', async () => {
    service.connect('http://localhost:8080/ws', 'token-123');
    service.disconnect();
    service.connect('http://localhost:8080/ws', 'token-123');

    await flushAsyncWork();

    expect(stomp.instances).toHaveLength(1);
    expect(stomp.instances[0].active).toBe(true);
  });
});
