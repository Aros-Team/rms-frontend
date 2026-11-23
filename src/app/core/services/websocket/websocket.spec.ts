import { TestBed } from '@angular/core/testing';

import { Logging } from '@app/core/services/logging/logging';
import { WebSocket } from './websocket';

interface FakeClientOptions {
  brokerURL?: string;
  connectHeaders?: Record<string, string>;
}

const { FakeClient, instances } = vi.hoisted(() => {
  const instances: FakeClient[] = [];

  class FakeClient {
    active = false;
    options: FakeClientOptions;
    onConnect?: (frame: unknown) => void;
    onStompError?: (frame: unknown) => void;
    onWebSocketError?: (event: unknown) => void;
    onWebSocketClose?: (event: unknown) => void;
    onDisconnect?: () => void;

    activate = vi.fn(() => {
      this.active = true;
    });
    deactivate = vi.fn(() => {
      this.active = false;
    });
    subscribe = vi.fn(() => ({ unsubscribe: vi.fn() }));

    constructor(options: FakeClientOptions) {
      this.options = options;
      instances.push(this);
    }
  }

  return { FakeClient, instances };
});

vi.mock('@stomp/stompjs', () => ({ Client: FakeClient }));

const logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

describe('WebSocket (native STOMP)', () => {
  let service: WebSocket;

  beforeEach(() => {
    instances.length = 0;
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [WebSocket, { provide: Logging, useValue: logger }],
    });
    service = TestBed.inject(WebSocket);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('connects to the native endpoint with the bearer header', () => {
    // Typed as void so a future async signature change fails the build.
    const connect: (url: string, token: string) => void = service.connect.bind(service);
    connect('ws://localhost:8080/ws-native', 'token-1');

    expect(instances).toHaveLength(1);
    expect(instances[0].options.brokerURL).toBe('ws://localhost:8080/ws-native');
    expect(instances[0].options.connectHeaders).toEqual({
      Authorization: 'Bearer token-1',
    });
    expect(instances[0].activate).toHaveBeenCalledTimes(1);
  });

  it('normalises http(s) endpoints to ws(s)', () => {
    service.connect('http://localhost:8080/ws-native', 'token');
    expect(instances[0].options.brokerURL).toBe('ws://localhost:8080/ws-native');

    service.disconnect();
    service.connect('https://api.rms.aros.services/ws-native', 'token');
    expect(instances[1].options.brokerURL).toBe('wss://api.rms.aros.services/ws-native');
  });

  it('does not open a second client while one is active', () => {
    service.connect('ws://localhost:8080/ws-native', 'token');
    service.connect('ws://localhost:8080/ws-native', 'token');

    expect(instances).toHaveLength(1);
  });

  it('deactivates the client on disconnect', () => {
    service.connect('ws://localhost:8080/ws-native', 'token');
    const client = instances[0];

    service.disconnect();

    expect(client.deactivate).toHaveBeenCalledTimes(1);
    expect(service.isConnected()).toBe(false);
  });

  it('reports the connection state when the STOMP handshake completes', () => {
    service.connect('ws://localhost:8080/ws-native', 'token');
    const states: boolean[] = [];
    service.connection$.subscribe((connected) => states.push(connected));

    instances[0].onConnect?.({});

    expect(service.isConnected()).toBe(true);
    expect(states).toEqual([false, true]);
  });

  it('subscribes to topics only after the connection is established', () => {
    const received: unknown[] = [];
    service.subscribeToTopic('topic/orders').subscribe((value) => received.push(value));
    expect(instances).toHaveLength(0);

    service.connect('ws://localhost:8080/ws-native', 'token');
    const client = instances[0];
    client.onConnect?.({});

    expect(client.subscribe).toHaveBeenCalledTimes(1);
    expect(client.subscribe.mock.calls[0][0]).toBe('topic/orders');
  });
});
