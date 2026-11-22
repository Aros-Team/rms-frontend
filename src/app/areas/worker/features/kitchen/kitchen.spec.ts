/**
 * Tests for the kitchen TV board.
 *
 * Feature: a line cook reads QUEUE / PREPARING / READY on a TV, grouped by
 * preparation station, with a live timer and one guarded action per step.
 * Contract:
 *  - the three columns render oldest first with real counts;
 *  - station comes from the product catalogue and the filter narrows the board;
 *  - the timer derives from the order date and crosses the overdue threshold;
 *  - "Tomar siguiente", "Marcar lista" and "Entregar" never submit twice;
 *  - WebSocket events are idempotent and a dropped socket starts polling; a
 *    reconnect refetches every column;
 *  - a failed column shows an error and a capped walk is declared.
 *
 * Approach: stub the four external boundaries (Order, Product, WebSocket,
 * KitchenAlerts) and mount the real component with the real DS primitives. The
 * specs exercise the DOM where the feature is visual and the signals where the
 * assertion is about request sequencing.
 */
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Order, type OrderCollection } from '@app/core/services/orders/order';
import { Product } from '@app/core/services/products/product';
import { WebSocket } from '@app/core/services/websocket/websocket';
import type { OrderDetailItem, OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { resolveUiResources } from '@app/shared/ui/testing/ui-test-resources';

import { Kitchen } from './kitchen';
import { KitchenAlerts } from './kitchen-alerts';
import kitchenHtml from './kitchen.html?raw';
import buttonHtml from '@app/shared/ui/button/button.html?raw';
import dialogHtml from '@app/shared/ui/dialog/dialog.html?raw';
import emptyStateHtml from '@app/shared/ui/empty-state/empty-state.html?raw';
import statusPillHtml from '@app/shared/ui/status-pill/status-pill.html?raw';

const PRICE = { amount: '10000.00', currency: 'COP' };

const PRODUCTS: ProductListResponse[] = [
  {
    id: 1,
    name: 'Hamburguesa',
    basePrice: PRICE,
    active: true,
    categoryId: 1,
    categoryName: 'Hamburguesas',
    areaId: 1,
    areaName: 'Cocina',
  },
  {
    id: 2,
    name: 'Limonada',
    basePrice: PRICE,
    active: true,
    categoryId: 6,
    categoryName: 'Bebidas',
    areaId: 3,
    areaName: 'Bar',
  },
];

function detail(
  id: number,
  productId: number,
  productName: string,
  overrides: Partial<OrderDetailItem> = {},
): OrderDetailItem {
  return {
    id,
    productId,
    productName,
    unitPrice: PRICE,
    instructions: '',
    ...overrides,
  };
}

function makeOrder(
  id: number,
  status: string,
  date: string,
  details: OrderDetailItem[],
  tableId = 1,
): OrderResponse {
  return { id, date, status, tableId, details };
}

function collection(items: OrderResponse[], total = items.length, truncated = false): OrderCollection {
  return { items, total, truncated };
}

function text(element: Element | null): string {
  return element?.textContent.replace(/\s+/g, ' ').trim() ?? '';
}

describe('Kitchen', () => {
  let fixture: ComponentFixture<Kitchen>;
  let component: Kitchen;

  let board: Record<string, OrderResponse[]>;
  let getAllByStatus: ReturnType<typeof vi.fn>;
  let orderStub: {
    getAllOrdersByStatus: ReturnType<typeof vi.fn>;
    prepareNext: ReturnType<typeof vi.fn>;
    markAsReady: ReturnType<typeof vi.fn>;
    deliverOrder: ReturnType<typeof vi.fn>;
  };
  let productStub: { getAllProducts: ReturnType<typeof vi.fn> };
  let wsEvents: Record<string, Subject<OrderResponse>>;
  let wsStub: {
    connect: ReturnType<typeof vi.fn>;
    connection$: BehaviorSubject<boolean>;
    subscribeToTopic: (topic: string) => Observable<OrderResponse>;
  };
  let muted: ReturnType<typeof signal<boolean>>;
  let blocked: ReturnType<typeof signal<boolean>>;
  let alertsStub: {
    muted: ReturnType<typeof signal<boolean>>;
    blocked: ReturnType<typeof signal<boolean>>;
    notify: ReturnType<typeof vi.fn>;
    arm: ReturnType<typeof vi.fn>;
    toggle: ReturnType<typeof vi.fn>;
    setMuted: ReturnType<typeof vi.fn>;
  };

  beforeAll(async () => {
    await resolveUiResources({
      'kitchen.html': kitchenHtml as unknown as string,
      'button.html': buttonHtml as unknown as string,
      'dialog.html': dialogHtml as unknown as string,
      'empty-state.html': emptyStateHtml as unknown as string,
      'status-pill.html': statusPillHtml as unknown as string,
    });
  });

  beforeEach(() => {
    board = {
      QUEUE: [
        makeOrder(102, 'QUEUE', '2026-01-01T12:10:00', [
          detail(1021, 1, 'Hamburguesa'),
          detail(1022, 1, 'Hamburguesa'),
          detail(1023, 2, 'Limonada'),
        ]),
        makeOrder(101, 'QUEUE', '2026-01-01T12:00:00', [
          detail(1011, 1, 'Hamburguesa', { instructions: 'Sin cebolla' }),
        ]),
      ],
      PREPARING: [
        makeOrder(103, 'PREPARING', '2026-01-01T11:50:00', [detail(1031, 1, 'Hamburguesa')]),
      ],
      READY: [
        makeOrder(104, 'READY', '2026-01-01T11:40:00', [detail(1041, 2, 'Limonada')]),
      ],
    };

    getAllByStatus = vi.fn((status: string) => of(collection(board[status] ?? [])));
    orderStub = {
      getAllOrdersByStatus: getAllByStatus,
      prepareNext: vi.fn(),
      markAsReady: vi.fn(),
      deliverOrder: vi.fn(),
    };
    productStub = { getAllProducts: vi.fn(() => of(PRODUCTS)) };

    wsEvents = {};
    wsStub = {
      connect: vi.fn(),
      connection$: new BehaviorSubject(true),
      subscribeToTopic: (topic: string) => {
        wsEvents[topic] ??= new Subject<OrderResponse>();
        return wsEvents[topic].asObservable();
      },
    };

    muted = signal(false);
    blocked = signal(false);
    alertsStub = {
      muted,
      blocked,
      notify: vi.fn(() => 'played'),
      arm: vi.fn(),
      toggle: vi.fn(() => {
        muted.set(!muted());
      }),
      setMuted: vi.fn((value: boolean) => {
        muted.set(value);
      }),
    };
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  async function configure(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Kitchen],
      providers: [
        { provide: Order, useValue: orderStub },
        { provide: Product, useValue: productStub },
        { provide: WebSocket, useValue: wsStub },
        { provide: Auth, useValue: { getToken: () => 'jwt-token' } },
        {
          provide: Logging,
          useValue: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        },
        { provide: KitchenAlerts, useValue: alertsStub },
      ],
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Kitchen);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function columnIds(column: string): string[] {
    return Array.from(
      host().querySelectorAll(`[data-column="${column}"] .ticket__number`),
    ).map((element) => text(element));
  }

  function innerButton(testId: string): HTMLButtonElement {
    const wrapper = host().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const button = wrapper?.querySelector('button');
    if (!button) throw new Error(`Expected a button inside [data-testid="${testId}"]`);
    return button;
  }

  function stationButton(name: string): HTMLButtonElement {
    const button = Array.from(host().querySelectorAll('.kitchen__stations button')).find((candidate) =>
      text(candidate).startsWith(name),
    );
    if (!button) throw new Error(`Expected a station button for "${name}"`);
    return button as HTMLButtonElement;
  }

  describe('board layout', () => {
    beforeEach(async () => {
      await configure();
    });

    it('renders the three columns oldest first with real counts', () => {
      expect(columnIds('queue')).toEqual(['#101', '#102']);
      expect(columnIds('preparing')).toEqual(['#103']);
      expect(columnIds('ready')).toEqual(['#104']);

      expect(text(host().querySelector('[data-testid="queue-count"]'))).toBe('2');
      expect(text(host().querySelector('[data-testid="preparing-count"]'))).toBe('1');
      expect(text(host().querySelector('[data-testid="ready-count"]'))).toBe('1');
      expect(host().querySelectorAll('h1')).toHaveLength(1);
      expect(text(host().querySelector('h1'))).toBe('Cocina');
      expect(getAllByStatus).toHaveBeenCalledWith('QUEUE', { sort: 'date,asc' });
      expect(productStub.getAllProducts).toHaveBeenCalledWith(true);
    });

    it('never renders the same order twice when a fetch repeats a row', () => {
      board.QUEUE.push({ ...board.QUEUE[0] });
      getAllByStatus.mockImplementation((status: string) =>
        of(collection(board[status] ?? [])),
      );

      component.fetchAll(true);
      fixture.detectChanges();

      expect(columnIds('queue')).toEqual(['#101', '#102']);
    });

    it('groups lines by station and shows quantities, options and notes', () => {
      const cocina = host().querySelector('[data-order-id="102"] [data-station="area:1"]');
      const bar = host().querySelector('[data-order-id="102"] [data-station="area:3"]');

      expect(text(cocina)).toContain('Hamburguesa');
      expect(text(cocina)).toContain('2×');
      expect(text(bar)).toContain('Limonada');
      expect(text(host().querySelector('[data-order-id="101"]'))).toContain('“Sin cebolla”');
    });

    it('narrows the board to a station and restores it with "Todas"', () => {
      expect(stationButton('Todas').getAttribute('aria-pressed')).toBe('true');
      expect(stationButton('Bar').getAttribute('aria-pressed')).toBe('false');

      stationButton('Bar').click();
      fixture.detectChanges();

      expect(component.selectedStation()).toBe('area:3');
      expect(stationButton('Bar').getAttribute('aria-pressed')).toBe('true');
      expect(columnIds('queue')).toEqual(['#102']);
      expect(text(host().querySelector('[data-testid="queue-count"]'))).toBe('1');
      expect(text(host().querySelector('[data-column="queue"] .kitchen-column__of'))).toBe('de 2');
      expect(columnIds('preparing')).toEqual([]);
      expect(columnIds('ready')).toEqual(['#104']);

      stationButton('Todas').click();
      fixture.detectChanges();

      expect(component.selectedStation()).toBe('all');
      expect(columnIds('queue')).toEqual(['#101', '#102']);
    });

    it('derives the timer from the order date and marks the overdue ticket', () => {
      component.now.set(Date.parse('2026-01-01T12:20:00'));
      fixture.detectChanges();

      const late = host().querySelector('[data-order-id="101"]');
      const warning = host().querySelector('[data-order-id="102"]');
      expect(late?.getAttribute('data-urgency')).toBe('late');
      expect(text(late?.querySelector('[data-testid="order-timer"]'))).toBe('20:00');
      expect(text(late)).toContain('Atrasado');
      expect(warning?.getAttribute('data-urgency')).toBe('warning');
      expect(text(warning?.querySelector('[data-testid="order-timer"]'))).toBe('10:00');
      expect(text(warning)).toContain('Atención');
    });

    it('toggles sound and reflects the persisted state', () => {
      const soundButton = Array.from(host().querySelectorAll('button')).find((button) =>
        text(button).startsWith('Sonido'),
      );
      expect(text(soundButton ?? null)).toContain('Sonido activado');

      soundButton?.click();
      fixture.detectChanges();

      expect(alertsStub.toggle).toHaveBeenCalledTimes(1);
      const mutedButton = Array.from(host().querySelectorAll('button')).find((button) =>
        text(button).startsWith('Sonido'),
      );
      expect(text(mutedButton ?? null)).toContain('Sonido desactivado');
    });

    it('opens the detail with quantities, combos and the order total', () => {
      const order = component.queueOrders().find((candidate) => candidate.id === 102);
      if (!order) throw new Error('Expected order 102');

      component.openDetail(order);
      fixture.detectChanges();

      expect(component.detailHeader()).toBe('Pedido #102');
      expect(component.detailLines().map((line) => [line.name, line.quantity])).toEqual([
        ['Hamburguesa', 2],
        ['Limonada', 1],
      ]);
      expect(component.detailGroups().map((group) => group.station.name)).toEqual(['Cocina', 'Bar']);
      expect(component.detailTotal()).toBe(30_000);
    });
  });

  describe('actions', () => {
    beforeEach(async () => {
      await configure();
    });

    it('locks "Tomar siguiente" while the request is in flight', () => {
      const pending = new Subject<OrderResponse>();
      orderStub.prepareNext.mockReturnValue(pending.asObservable());

      innerButton('prepare-next').click();
      fixture.detectChanges();
      innerButton('prepare-next').click();

      expect(orderStub.prepareNext).toHaveBeenCalledTimes(1);
      expect(component.preparingNext()).toBe(true);
      expect(innerButton('prepare-next').disabled).toBe(true);

      pending.next(makeOrder(101, 'PREPARING', '2026-01-01T12:00:00', []));
      pending.complete();
      fixture.detectChanges();

      expect(component.preparingNext()).toBe(false);
      expect(columnIds('queue')).toEqual(['#102']);
      expect(component.preparingOrders().map((order) => order.id)).toContain(101);
    });

    it('marks an order ready once and moves it to the READY column', () => {
      const pending = new Subject<OrderResponse>();
      orderStub.markAsReady.mockReturnValue(pending.asObservable());

      innerButton('mark-ready').click();
      innerButton('mark-ready').click();

      expect(orderStub.markAsReady).toHaveBeenCalledTimes(1);
      expect(component.isProcessing(103)).toBe(true);

      pending.next(
        makeOrder(103, 'READY', '2026-01-01T11:50:00', [detail(1031, 1, 'Hamburguesa')]),
      );
      pending.complete();
      fixture.detectChanges();

      expect(component.isProcessing(103)).toBe(false);
      expect(columnIds('preparing')).toEqual([]);
      expect(columnIds('ready')).toEqual(['#104', '#103']);
    });

    it('asks for confirmation before delivering and never double-submits', () => {
      const order = component.readyOrders()[0];
      const pending = new Subject<OrderResponse>();
      orderStub.deliverOrder.mockReturnValue(pending.asObservable());

      component.askDeliver(order);
      fixture.detectChanges();
      expect(component.deliverTarget()?.id).toBe(104);
      expect(component.deliverHeader()).toBe('Entregar pedido #104');

      component.confirmDeliver();
      component.confirmDeliver();

      expect(orderStub.deliverOrder).toHaveBeenCalledTimes(1);
      expect(component.deliverBusy()).toBe(true);

      pending.next(order);
      pending.complete();
      fixture.detectChanges();

      expect(component.deliverBusy()).toBe(false);
      expect(component.deliverTarget()).toBeNull();
      expect(columnIds('ready')).toEqual([]);
    });

    it('keeps the board painted and disables the action while delivering', () => {
      const order = component.readyOrders()[0];
      orderStub.deliverOrder.mockReturnValue(new Subject<OrderResponse>().asObservable());

      component.askDeliver(order);
      component.confirmDeliver();
      fixture.detectChanges();

      expect(component.deliverBusy()).toBe(true);
      component.onDeliverVisible(false);
      expect(component.deliverTarget()?.id).toBe(104);
    });

    it('takes the next order from the T shortcut', () => {
      orderStub.prepareNext.mockReturnValue(
        of(makeOrder(101, 'PREPARING', '2026-01-01T12:00:00', [])),
      );

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
      fixture.detectChanges();

      expect(orderStub.prepareNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('realtime, fallback and failure', () => {
    beforeEach(async () => {
      await configure();
    });

    it('patches created, preparing, ready, delivered and cancelled events idempotently', () => {
      const created = makeOrder(900, 'QUEUE', '2026-01-01T12:15:00', [detail(9001, 1, 'Hamburguesa')]);
      wsEvents['/topic/orders/created'].next(created);
      fixture.detectChanges();

      expect(component.queueOrders()).toHaveLength(3);
      expect(alertsStub.notify).toHaveBeenCalledTimes(1);
      expect(component.announcement()).toContain('Nuevo pedido #900');

      wsEvents['/topic/orders/created'].next(created);
      fixture.detectChanges();
      expect(component.queueOrders()).toHaveLength(3);
      expect(alertsStub.notify).toHaveBeenCalledTimes(1);

      wsEvents['/topic/orders/preparing'].next({ ...created, status: 'PREPARING' });
      fixture.detectChanges();
      expect(component.queueOrders()).toHaveLength(2);
      expect(component.preparingOrders()).toHaveLength(2);

      wsEvents['/topic/orders/ready'].next({ ...created, status: 'READY' });
      fixture.detectChanges();
      expect(component.preparingOrders()).toHaveLength(1);
      expect(component.readyOrders()).toHaveLength(2);

      wsEvents['/topic/orders/delivered'].next({ ...created, status: 'DELIVERED' });
      fixture.detectChanges();
      expect(component.readyOrders()).toHaveLength(1);

      wsEvents['/topic/orders/cancelled'].next(
        makeOrder(102, 'CANCELLED', '2026-01-01T12:10:00', []),
      );
      fixture.detectChanges();
      expect(component.queueOrders().map((order) => order.id)).toEqual([101]);
    });

    it('polls after a disconnect and refetches every column on reconnect', async () => {
      fixture.destroy();
      vi.useFakeTimers();
      await configure();

      const initialCalls = getAllByStatus.mock.calls.length;
      wsStub.connection$.next(false);
      fixture.detectChanges();

      expect(component.wsConnected()).toBe(false);
      expect(component.polling()).toBe(true);

      vi.advanceTimersByTime(10_000);
      expect(getAllByStatus).toHaveBeenCalledTimes(initialCalls + 3);

      wsStub.connection$.next(true);
      fixture.detectChanges();

      expect(component.polling()).toBe(false);
      expect(getAllByStatus).toHaveBeenCalledTimes(initialCalls + 6);
    });

    it('shows the error banner and stops the spinner when a column fails', () => {
      getAllByStatus.mockImplementation((status: string) =>
        status === 'QUEUE' ? throwError(() => new Error('boom')) : of(collection(board[status] ?? [])),
      );

      component.fetchAll(true);
      fixture.detectChanges();

      expect(component.error()).toBe('Error cargando la cola.');
      expect(component.loading()).toBe(false);
      expect(component.refreshing()).toBe(false);
      expect(text(host().querySelector('[role="alert"]'))).toContain('Error cargando la cola.');
    });

    it('declares a capped column instead of presenting it as complete', () => {
      getAllByStatus.mockImplementation((status: string) =>
        of(
          status === 'QUEUE'
            ? collection(board.QUEUE.slice(0, 2), 5000, true)
            : collection(board[status] ?? []),
        ),
      );

      component.fetchAll(true);
      fixture.detectChanges();

      expect(text(host().querySelector('[data-testid="queue-limit"]'))).toBe(
        '· vista limitada: 2 de 5000',
      );
    });

    it('surfaces a station-catalogue failure without dropping the order', async () => {
      productStub.getAllProducts.mockReturnValue(throwError(() => new Error('no catalogue')));
      fixture.destroy();
      await configure();

      expect(component.stationError()).toContain('No se pudo cargar el mapa de estaciones');
      expect(columnIds('queue')).toEqual(['#101', '#102']);
      expect(text(host().querySelector('[data-column="queue"] [data-station="unknown"]'))).toContain(
        'Hamburguesa',
      );
    });
  });
});
