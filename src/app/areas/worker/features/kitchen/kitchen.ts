import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { Subscription, type Observable } from 'rxjs';

import { Auth } from '@app/core/services/auth/auth';
import { Logging } from '@app/core/services/logging/logging';
import { Order, type OrderQuery, type OrderStatus } from '@app/core/services/orders/order';
import { Product } from '@app/core/services/products/product';
import { WebSocket } from '@app/core/services/websocket/websocket';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response';
import type { ProductListResponse } from '@app/shared/models/dto/products/product-list-response';
import { RmsButton } from '@app/shared/ui/button/button';
import { RmsIconButton } from '@app/shared/ui/icon-button/icon-button';
import { RmsStatusPill } from '@app/shared/ui/status-pill/status-pill';
import type { RmsStatus } from '@app/shared/ui/types/ui-types';
import { environment } from '@environments/environment';

import { KitchenAlerts } from './kitchen-alerts';
import {
  groupKitchenLines,
  isLineReady,
  totalKitchenItems,
  type KitchenLine,
} from './kitchen-lines';
import {
  buildStationMap,
  groupLinesByStation,
  orderHasStation,
  orderStations,
  stationAreaId,
  stationCounts,
  type KitchenStationMap,
  type StationColumns,
  type StationCount,
  type StationGroup,
} from './kitchen-stations';
import {
  formatAge,
  formatOrderTime,
  orderAgeMs,
  urgencyFor as urgencyForAge,
  urgencyLabel,
  type KitchenUrgency,
} from './kitchen-time';

const WS_TOPICS = {
  created: '/topic/orders/created',
  preparing: '/topic/orders/preparing',
  ready: '/topic/orders/ready',
  delivered: '/topic/orders/delivered',
  cancelled: '/topic/orders/cancelled',
} as const;

/** Columns of the kitchen board, one per status. */
export type KitchenColumn = 'queue' | 'preparing' | 'ready';

const STATUS_BY_COLUMN: Record<KitchenColumn, OrderStatus> = {
  queue: 'QUEUE',
  preparing: 'PREPARING',
  ready: 'READY',
};

const COLUMN_BY_STATUS: Record<string, KitchenColumn> = {
  QUEUE: 'queue',
  PREPARING: 'preparing',
  READY: 'ready',
};

/** Shown/total pair rendered when a column's page walk hit `MAX_ORDER_PAGES`. */
export interface ColumnLimit {
  shown: number;
  total: number;
}

const NO_LIMITS: Record<KitchenColumn, ColumnLimit | null> = {
  queue: null,
  preparing: null,
  ready: null,
};

interface KitchenColumnView {
  key: KitchenColumn;
  label: string;
  orders: readonly OrderResponse[];
  limit: ColumnLimit | null;
}

/** RFC 7807 problem responses expose the human-readable text in `detail`. */
function problemDetail(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const body = (error as { error?: unknown }).error;
  if (typeof body !== 'object' || body === null) return null;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim().length > 0) return detail;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return null;
}

function sortOldestFirst(orders: readonly OrderResponse[]): OrderResponse[] {
  // De-duplicate by id: a fetch page and a WebSocket event can overlap, and the
  // board must never render the same ticket twice.
  const byId = new Map<number, OrderResponse>();
  for (const order of orders) byId.set(order.id, order);

  return [...byId.values()].sort((left, right) => {
    const leftTime = Date.parse(left.date);
    const rightTime = Date.parse(right.date);
    const safeLeft = Number.isFinite(leftTime) ? leftTime : 0;
    const safeRight = Number.isFinite(rightTime) ? rightTime : 0;
    if (safeLeft !== safeRight) return safeLeft - safeRight;
    return left.id - right.id;
  });
}

function replaceById(orders: readonly OrderResponse[], order: OrderResponse): OrderResponse[] {
  const index = orders.findIndex((candidate) => candidate.id === order.id);
  if (index === -1) return [...orders, order];
  const next = [...orders];
  next[index] = order;
  return next;
}

/**
 * Kitchen station board.
 *
 * Job stories:
 *  - As a line cook, I see QUEUE / PREPARING / READY with counts and a timer per
 *    order, so I know what to cook next and what is running late.
 *  - As a line cook, I can read quantities, options, combos, additions and notes
 *    on the ticket itself, so I do not misread it and never open a second screen.
 *  - As a line cook, a ticket carries exactly ONE action: take it or mark it
 *    ready. The board never submits twice and tells me when the action failed.
 *  - As a line cook on a 1920x1080 TV (1024x768 fallback), I read the pass from
 *    ~3 m; at 1024 the same three columns fit without horizontal scroll.
 *
 * Station awareness: the order line carries `areaId`/`areaName` resolved by the
 * backend. The board groups by that field and only falls back to the product
 * catalogue when the API sends no area. Selecting an `area:<id>` station is a
 * **server-side** `areaId` filter; category/unknown stations are filtered
 * client-side because the API has no equivalent parameter.
 *
 * Per-line readiness is still persisted and rendered (a completed line shows a
 * check and success ink), but the board no longer exposes a control per line:
 * the cook advances the whole ticket and the area-scoped endpoints decide which
 * lines complete.
 *
 * Realtime: STOMP topics patch the columns locally; when the socket drops the
 * board polls every 10 s and labels itself "Reconectando". A reconnect refetches
 * all three columns to recover missed events. Every insertion is idempotent.
 * Events for tickets outside the selected station are ignored.
 */
@Component({
  selector: 'app-kitchen',
  imports: [RmsButton, RmsIconButton, RmsStatusPill],
  templateUrl: './kitchen.html',
  styleUrl: './kitchen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Kitchen implements OnInit, OnDestroy {
  private readonly orderService = inject(Order);
  private readonly productService = inject(Product);
  private readonly wsService = inject(WebSocket);
  private readonly authService = inject(Auth);
  private readonly logger = inject(Logging);
  private readonly alerts = inject(KitchenAlerts);

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly error = signal<string | null>(null);
  readonly stationError = signal<string | null>(null);
  readonly stationReady = signal(false);
  readonly wsConnected = signal(false);
  readonly polling = signal(false);

  /** Wall clock for every timer. One signal, one text change per second. */
  readonly now = signal(Date.now());

  readonly queueOrders = signal<readonly OrderResponse[]>([]);
  readonly preparingOrders = signal<readonly OrderResponse[]>([]);
  readonly readyOrders = signal<readonly OrderResponse[]>([]);

  /**
   * Per-column page-walk notice. Non-null only when that column hit
   * `MAX_ORDER_PAGES`, i.e. the rendered list is a prefix of the real set.
   */
  readonly limits = signal<Record<KitchenColumn, ColumnLimit | null>>({ ...NO_LIMITS });

  readonly processingIds = signal<ReadonlySet<number>>(new Set());
  readonly preparingNext = signal(false);

  readonly selectedStation = signal('all');
  readonly newOrderIds = signal<ReadonlySet<number>>(new Set());
  readonly announcement = signal('');

  /**
   * Preparation areas assigned to this worker. `null` means the user data is
   * not available yet, so the board keeps the legacy "all stations" behaviour.
   * An empty set means the worker has no preparation area (the guard should
   * have blocked the route).
   */
  private readonly assignedPrepAreaIds = signal<ReadonlySet<number> | null>(null);
  private readonly areaNames = new Map<number, string>();

  readonly muted = this.alerts.muted;
  readonly audioBlocked = this.alerts.blocked;

  /**
   * Last unfiltered board. Station chips keep their counts when a server-side
   * station filter is active; polling only refreshes the selected station.
   */
  private readonly boardSnapshot = signal<StationColumns>({
    queue: [],
    preparing: [],
    ready: [],
  });

  private readonly stationMap = signal<KitchenStationMap>(new Map());

  private wsSubs: Subscription[] = [];
  private pollingInterval?: ReturnType<typeof setInterval>;
  private clockInterval?: ReturnType<typeof setInterval>;
  private fetching = false;
  private refetchRequested = false;
  /** Invalidates in-flight column responses when the station changes. */
  private fetchToken = 0;
  private catalogLoaded = false;
  private catalogLoading = false;
  private hadConnection = false;
  private readonly newOrderTimers = new Set<ReturnType<typeof setTimeout>>();

  /** First pointer/key event arms WebAudio without blocking the page. */
  private readonly armAudio = (): void => {
    this.alerts.arm();
  };

  readonly knownIds = computed<ReadonlySet<number>>(() => {
    const ids = new Set<number>();
    for (const order of this.queueOrders()) ids.add(order.id);
    for (const order of this.preparingOrders()) ids.add(order.id);
    for (const order of this.readyOrders()) ids.add(order.id);
    return ids;
  });

  readonly stationOptions = computed<readonly StationCount[]>(() => {
    const counts = stationCounts(
      this.selectedStation() === 'all' ? this.currentColumns() : this.boardSnapshot(),
      this.stationMap(),
    );
    if (this.assignedPrepAreaIds() === null) return counts;
    return counts.filter((station) => this.stationInScope(station.key));
  });

  readonly stationFilterVisible = computed(() => this.stationOptions().length > 1);

  readonly activeTotal = computed(() => {
    const orders = [...this.queueOrders(), ...this.preparingOrders(), ...this.readyOrders()];
    if (this.assignedPrepAreaIds() === null) return orders.length;
    const ids = new Set<number>();
    for (const order of orders) {
      if (this.orderInScope(order)) ids.add(order.id);
    }
    return ids.size;
  });

  readonly selectedStationName = computed(() => {
    const key = this.selectedStation();
    if (key === 'all') return 'Todas las estaciones';
    const known = this.stationOptions().find((station) => station.key === key)?.name;
    if (known) return known;
    const areaId = stationAreaId(key);
    return areaId !== null ? (this.areaNames.get(areaId) ?? 'Estación') : 'Estación';
  });

  readonly queueView = computed(() => this.filterColumn(this.queueOrders()));
  readonly preparingView = computed(() => this.filterColumn(this.preparingOrders()));
  readonly readyView = computed(() => this.filterColumn(this.readyOrders()));

  readonly columns = computed<readonly KitchenColumnView[]>(() => [
    {
      key: 'queue',
      label: this.columnLabel('queue'),
      orders: this.queueView(),
      limit: this.limitFor('queue'),
    },
    {
      key: 'preparing',
      label: this.columnLabel('preparing'),
      orders: this.preparingView(),
      limit: this.limitFor('preparing'),
    },
    {
      key: 'ready',
      label: this.columnLabel('ready'),
      orders: this.readyView(),
      limit: this.limitFor('ready'),
    },
  ]);

  readonly nextOrder = computed<OrderResponse | null>(() => this.queueView()[0] ?? null);

  readonly connectionLabel = computed(() => {
    if (this.wsConnected()) return 'En vivo';
    if (this.polling()) return 'Reconectando';
    return 'Sin conexión';
  });
  readonly connectionTone = computed<RmsStatus>(() => {
    if (this.wsConnected()) return 'success';
    if (this.polling()) return 'warning';
    return 'danger';
  });

  ngOnInit(): void {
    this.applyAssignedPrepAreas();
    this.loadCatalog();
    this.fetchAll();
    this.connectWebSocket();
    this.clockInterval = setInterval(() => {
      this.now.set(Date.now());
    }, 1000);
    window.addEventListener('pointerdown', this.armAudio, { once: true, passive: true });
    window.addEventListener('keydown', this.armAudio, { once: true });
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.stopPolling();
    for (const sub of this.wsSubs) sub.unsubscribe();
    for (const timer of this.newOrderTimers) clearTimeout(timer);
    this.newOrderTimers.clear();
    window.removeEventListener('pointerdown', this.armAudio);
    window.removeEventListener('keydown', this.armAudio);
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return;
    }

    switch (event.key.toLowerCase()) {
      case 't':
        event.preventDefault();
        this.prepareNext();
        break;
      case 'r':
        event.preventDefault();
        this.refresh();
        break;
      case 'm':
        event.preventDefault();
        this.toggleSound();
        break;
      default:
        break;
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  /**
   * Loads the product catalogue once so `productId -> preparation area` is
   * available. Failure is non-fatal: lines fall back to "Sin estación".
   */
  loadCatalog(force = false): void {
    if (this.catalogLoading) return;
    if (this.catalogLoaded && !force) return;

    this.catalogLoading = true;
    this.stationError.set(null);
    // `includeSelections=true` is required: combos and "menú del día" products
    // are `SPECIAL_SELECTION` rows that the default catalogue omits. Without it
    // a live "Almuerzo Ejecutivo" line fell into "Sin estación".
    this.productService.getAllProducts(true).subscribe({
      next: (products: ProductListResponse[]) => {
        this.stationMap.set(buildStationMap(products));
        this.catalogLoaded = true;
        this.catalogLoading = false;
        this.stationReady.set(true);
        if (products.length === 0) {
          this.stationError.set(
            'El catálogo no devolvió productos; los ítems se agrupan en «Sin estación».',
          );
        }
      },
      error: (error: unknown) => {
        this.catalogLoading = false;
        this.stationReady.set(true);
        this.logger.warn('Kitchen: station catalogue failed', error);
        this.stationError.set(
          'No se pudo cargar el mapa de estaciones; los ítems se agrupan en «Sin estación».',
        );
      },
    });
  }

  fetchAll(silent = false): void {
    if (this.fetching) {
      // A station change (or another caller) arrived mid-flight: refetch once
      // the current walk finishes instead of dropping the request.
      this.refetchRequested = true;
      return;
    }
    this.fetching = true;
    this.refetchRequested = false;
    const token = (this.fetchToken += 1);
    const areaId = this.selectedAreaId();
    const query = { sort: 'date,asc', ...(areaId !== null ? { areaId } : {}) };

    if (silent) this.refreshing.set(true);
    else this.loading.set(true);
    this.error.set(null);

    let doneCount = 0;
    let failed = false;
    const done = (): void => {
      doneCount += 1;
      if (doneCount < 3) return;
      this.fetching = false;
      this.loading.set(false);
      this.refreshing.set(false);
      const current = token === this.fetchToken;
      if (current && !failed && areaId === null) {
        this.boardSnapshot.set(this.currentColumns());
      }
      if (this.refetchRequested) {
        this.refetchRequested = false;
        this.fetchAll(true);
      }
    };

    const onError = (): void => {
      failed = true;
      done();
    };

    this.loadColumn(
      'QUEUE',
      'queue',
      this.queueOrders,
      'Error cargando la cola.',
      query,
      token,
      onError,
      done,
    );
    this.loadColumn(
      'PREPARING',
      'preparing',
      this.preparingOrders,
      'Error cargando preparación.',
      query,
      token,
      onError,
      done,
    );
    this.loadColumn(
      'READY',
      'ready',
      this.readyOrders,
      'Error cargando los pedidos listos.',
      query,
      token,
      onError,
      done,
    );
  }

  /** Manual refresh keeps the board painted; only the initial load shows a skeleton. */
  refresh(): void {
    this.loadCatalog(true);
    this.fetchAll(true);
  }

  /**
   * Loads one whole column through the bounded page walk
   * (`Order.getAllOrdersByStatus`), oldest first, with the station `areaId`
   * forwarded server-side. Results from an invalidated walk (the cook changed
   * station while it was running) are discarded.
   */
  private loadColumn(
    status: OrderStatus,
    column: KitchenColumn,
    target: WritableSignal<readonly OrderResponse[]>,
    errorMessage: string,
    query: OrderQuery,
    token: number,
    onError: () => void,
    done: () => void,
  ): void {
    this.orderService.getAllOrdersByStatus(status, query).subscribe({
      next: (result) => {
        if (token !== this.fetchToken) {
          done();
          return;
        }
        target.set(sortOldestFirst(result.items));
        this.limits.update((current) => ({
          ...current,
          [column]: result.truncated ? { shown: result.items.length, total: result.total } : null,
        }));
        done();
      },
      error: (error: unknown) => {
        this.logger.warn(`Kitchen: ${column} column failed`, error);
        if (token === this.fetchToken) this.error.set(errorMessage);
        onError();
      },
    });
  }

  /** Truncation notice for a column, or `null` when the whole set was loaded. */
  limitFor(column: KitchenColumn): ColumnLimit | null {
    return this.limits()[column];
  }

  // ── Realtime and polling ──────────────────────────────────────────────────

  private connectWebSocket(): void {
    const token = this.authService.getToken();
    if (!token) {
      this.logger.debug('Kitchen: no token available, falling back to polling');
      this.startPolling();
      return;
    }

    this.wsService.connect(environment.wsUrl, token);

    const connectionSub = this.wsService.connection$.subscribe({
      next: (connected) => {
        const wasConnected = this.wsConnected();
        this.wsConnected.set(connected);

        if (!connected) {
          this.startPolling();
          return;
        }

        this.stopPolling();
        // A reconnect may have missed events: refetch once instead of trusting
        // a partial local list.
        if (this.hadConnection && !wasConnected) {
          this.fetchAll(true);
          this.loadCatalog(true);
        }
        this.hadConnection = true;
      },
    });
    this.wsSubs.push(connectionSub);

    this.wsSubs.push(
      this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.created).subscribe({
        next: (order) => {
          this.onOrderCreated(order);
        },
      }),
    );
    this.wsSubs.push(
      this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.preparing).subscribe({
        next: (order) => {
          if (!this.matchesSelectedStation(order)) return;
          this.preparingNext.set(false);
          this.moveOrder('preparing', order);
        },
      }),
    );
    this.wsSubs.push(
      this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.ready).subscribe({
        next: (order) => {
          if (!this.matchesSelectedStation(order)) return;
          this.setProcessing(order.id, false);
          this.moveOrder('ready', order);
        },
      }),
    );
    this.wsSubs.push(
      this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.delivered).subscribe({
        next: (order) => {
          this.setProcessing(order.id, false);
          this.removeEverywhere(order.id);
        },
      }),
    );
    this.wsSubs.push(
      this.wsService.subscribeToTopic<OrderResponse>(WS_TOPICS.cancelled).subscribe({
        next: (order) => {
          this.setProcessing(order.id, false);
          this.removeEverywhere(order.id);
        },
      }),
    );
  }

  private onOrderCreated(order: OrderResponse): void {
    if (this.knownIds().has(order.id)) {
      this.logger.debug('Kitchen: created event for an order already on the board', order.id);
      return;
    }
    if (!this.matchesSelectedStation(order)) {
      this.logger.debug('Kitchen: created event outside the selected station', order.id);
      return;
    }

    const column = COLUMN_BY_STATUS[order.status] ?? 'queue';
    this.upsert(column, order);

    if (column !== 'queue') return;

    this.markNew(order.id);
    this.announce(`Nuevo pedido #${String(order.id)} para la mesa ${this.tableLabel(order)}.`);

    const result = this.alerts.notify();
    if (result === 'blocked') {
      this.logger.warn('Kitchen: the browser blocked the new-order sound');
    }
  }

  private startPolling(): void {
    if (this.pollingInterval) return;
    this.logger.warn('Kitchen: WebSocket unavailable, polling every 10 s');
    this.polling.set(true);
    this.pollingInterval = setInterval(() => {
      this.fetchAll(true);
    }, 10_000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
    this.polling.set(false);
  }

  // ── List mutations (idempotent) ──────────────────────────────────────────

  private signalFor(column: KitchenColumn): WritableSignal<readonly OrderResponse[]> {
    switch (column) {
      case 'preparing':
        return this.preparingOrders;
      case 'ready':
        return this.readyOrders;
      default:
        return this.queueOrders;
    }
  }

  private upsert(column: KitchenColumn, order: OrderResponse): void {
    const normalized: OrderResponse = { ...order, status: STATUS_BY_COLUMN[column] };
    this.signalFor(column).update((current) => sortOldestFirst(replaceById(current, normalized)));
  }

  private moveOrder(column: KitchenColumn, order: OrderResponse): void {
    this.queueOrders.update((list) => list.filter((candidate) => candidate.id !== order.id));
    this.preparingOrders.update((list) => list.filter((candidate) => candidate.id !== order.id));
    this.readyOrders.update((list) => list.filter((candidate) => candidate.id !== order.id));
    this.clearNew(order.id);
    this.upsert(column, order);
  }

  private removeEverywhere(id: number): void {
    this.queueOrders.update((list) => list.filter((order) => order.id !== id));
    this.preparingOrders.update((list) => list.filter((order) => order.id !== id));
    this.readyOrders.update((list) => list.filter((order) => order.id !== id));
    this.clearNew(id);
  }

  private clearNew(id: number): void {
    this.newOrderIds.update((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  private markNew(id: number): void {
    this.newOrderIds.update((current) => new Set(current).add(id));
    const timer = setTimeout(() => {
      this.newOrderIds.update((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      this.newOrderTimers.delete(timer);
    }, 8000);
    this.newOrderTimers.add(timer);
  }

  private announce(message: string): void {
    this.announcement.set(message);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Claims the oldest QUEUE order through the global FIFO endpoint
   * (`PUT /v1/orders/prepare`). A filtered board shows the oldest matching
   * ticket, but the FIFO claim itself is still global; use {@link prepareOrder}
   * to start one specific card.
   */
  prepareNext(): void {
    if (this.preparingNext()) return;
    const next = this.nextOrder();
    if (next === null) return;

    this.preparingNext.set(true);
    this.error.set(null);

    const selectedArea = this.selectedAreaId();
    const scoped = this.assignedPrepAreaIds();
    const areaIds =
      selectedArea !== null
        ? [selectedArea]
        : scoped !== null
          ? this.assignedAreaIdsInOrder(next)
          : [];

    const onDone = (order: OrderResponse): void => {
      this.preparingNext.set(false);
      this.applyOrderUpdate(order);
      this.announce(`Pedido #${String(order.id)} en preparación.`);
    };
    const onError = (error: unknown): void => {
      this.preparingNext.set(false);
      this.error.set(problemDetail(error) ?? 'No se pudo tomar el siguiente pedido.');
    };

    if (selectedArea === null && scoped === null) {
      this.orderService.prepareNext().subscribe({ next: onDone, error: onError });
      return;
    }
    if (areaIds.length === 0) {
      this.preparingNext.set(false);
      return;
    }
    this.runAreaSequence(
      next,
      areaIds,
      (areaId) => this.orderService.startArea(next.id, areaId),
      onDone,
      onError,
    );
  }

  /** Starts one specific QUEUE ticket (`PUT /v1/orders/{id}/prepare`). */
  prepareOrder(order: OrderResponse): void {
    if (this.isProcessing(order.id)) return;

    this.setProcessing(order.id, true);
    this.error.set(null);

    const selectedArea = this.selectedAreaId();
    const scoped = this.assignedPrepAreaIds();
    const areaIds =
      selectedArea !== null
        ? [selectedArea]
        : scoped !== null
          ? this.assignedAreaIdsInOrder(order)
          : [];

    const onDone = (updated: OrderResponse): void => {
      this.setProcessing(order.id, false);
      this.applyOrderUpdate(updated);
      this.announce(`Pedido #${String(updated.id)} preparándose en la estación.`);
    };
    const onError = (error: unknown): void => {
      this.setProcessing(order.id, false);
      this.error.set(problemDetail(error) ?? 'No se pudo tomar este pedido.');
    };

    if (selectedArea === null && scoped === null) {
      this.orderService.prepareOrder(order.id).subscribe({ next: onDone, error: onError });
      return;
    }
    if (areaIds.length === 0) {
      this.setProcessing(order.id, false);
      return;
    }
    this.runAreaSequence(
      order,
      areaIds,
      (areaId) => this.orderService.startArea(order.id, areaId),
      onDone,
      onError,
    );
  }

  markReady(order: OrderResponse): void {
    if (this.processingIds().has(order.id)) return;

    this.setProcessing(order.id, true);
    this.error.set(null);

    const selectedArea = this.selectedAreaId();
    const scoped = this.assignedPrepAreaIds();
    const areaIds =
      selectedArea !== null
        ? [selectedArea]
        : scoped !== null
          ? this.assignedAreaIdsInOrder(order)
          : [];

    const onDone = (updated: OrderResponse): void => {
      this.setProcessing(order.id, false);
      this.moveOrder('ready', updated);
      this.announce(`Pedido #${String(order.id)} listo para entregar.`);
    };
    const onError = (error: unknown): void => {
      this.setProcessing(order.id, false);
      this.error.set(problemDetail(error) ?? 'No se pudo marcar el pedido como listo.');
    };

    if (selectedArea === null && scoped === null) {
      this.orderService.markAsReady(order.id).subscribe({ next: onDone, error: onError });
      return;
    }
    if (areaIds.length === 0) {
      this.setProcessing(order.id, false);
      return;
    }
    this.runAreaSequence(
      order,
      areaIds,
      (areaId) => this.orderService.markAreaReady(order.id, areaId),
      onDone,
      onError,
    );
  }

  /** Runs one area-scoped request per assigned area, sequentially. */
  private runAreaSequence(
    order: OrderResponse,
    areaIds: readonly number[],
    call: (areaId: number) => Observable<OrderResponse>,
    onDone: (order: OrderResponse) => void,
    onError: (error: unknown) => void,
  ): void {
    let index = 0;
    let latest = order;
    const step = (): void => {
      if (index >= areaIds.length) {
        onDone(latest);
        return;
      }
      call(areaIds[index]).subscribe({
        next: (updated) => {
          latest = updated;
          index += 1;
          step();
        },
        error: onError,
      });
    };
    step();
  }

  isProcessing(id: number): boolean {
    return this.processingIds().has(id);
  }

  private setProcessing(id: number, value: boolean): void {
    this.processingIds.update((current) => {
      const next = new Set(current);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Applies an order returned by any transition endpoint to its column. */
  private applyOrderUpdate(updated: OrderResponse): void {
    const column = COLUMN_BY_STATUS[updated.status] ?? 'preparing';
    this.moveOrder(column, updated);
  }

  // ── Item readiness helpers (template) ─────────────────────────────────────

  lineReady(line: KitchenLine): boolean {
    return isLineReady(line);
  }

  // ── Station filter ────────────────────────────────────────────────────────

  /**
   * Restricts the board to the preparation areas assigned to this worker.
   *
   * A bar worker must not see kitchen tickets (and vice versa). With a single
   * assigned area the board starts already filtered on it, so the initial fetch
   * is a server-side `areaId` query. With several areas the board keeps "Todas"
   * but every count, ticket and station group is scoped to those areas.
   */
  private applyAssignedPrepAreas(): void {
    const user = this.authService.getData();
    if (!user) return;

    for (const area of user.areas) {
      this.areaNames.set(area.id, area.name);
    }

    const ids = new Set<number>();
    const assignments = user.areaActivities ?? [];
    if (assignments.length > 0) {
      for (const assignment of assignments) {
        if (assignment.activities.includes('PREPARATION')) ids.add(assignment.areaId);
      }
    } else {
      for (const area of user.areas) {
        if (area.activities?.includes('PREPARATION')) ids.add(area.id);
      }
    }

    this.assignedPrepAreaIds.set(ids);
    if (ids.size === 1) {
      const [areaId] = [...ids];
      this.selectedStation.set(`area:${String(areaId)}`);
    }
  }

  private stationInScope(stationKey: string): boolean {
    const allowed = this.assignedPrepAreaIds();
    if (allowed === null) return true;
    const areaId = stationAreaId(stationKey);
    return areaId !== null && allowed.has(areaId);
  }

  private orderInScope(order: OrderResponse): boolean {
    if (this.assignedPrepAreaIds() === null) return true;
    return orderStations(order, this.stationMap()).some((station) =>
      this.stationInScope(station.key),
    );
  }

  /** Assigned preparation areas present in an order, in station order. */
  private assignedAreaIdsInOrder(order: OrderResponse): number[] {
    const allowed = this.assignedPrepAreaIds();
    if (allowed === null) return [];
    const ids: number[] = [];
    for (const station of orderStations(order, this.stationMap())) {
      const areaId = stationAreaId(station.key);
      if (areaId !== null && allowed.has(areaId) && !ids.includes(areaId)) {
        ids.push(areaId);
      }
    }
    return ids;
  }

  selectStation(key: string): void {
    if (this.selectedStation() === key) return;
    if (!this.stationInScope(key)) return;
    this.selectedStation.set(key);
    // Invalidate a walk that belongs to the previous station, then refetch.
    this.fetchToken += 1;
    this.fetchAll(true);
  }

  isStationSelected(key: string): boolean {
    return this.selectedStation() === key;
  }

  private currentColumns(): StationColumns {
    return {
      queue: this.queueOrders(),
      preparing: this.preparingOrders(),
      ready: this.readyOrders(),
    };
  }

  /** `areaId` sent to the API, or `null` for "all"/category/unknown stations. */
  private selectedAreaId(): number | null {
    const key = this.selectedStation();
    return key === 'all' ? null : stationAreaId(key);
  }

  /**
   * The server already filtered an `area:<id>` station, so re-filtering the
   * tickets here would drop nothing but could disagree with the API when an
   * order has no resolvable station client-side. Category/unknown stations are
   * client-only and still filter by order.
   */
  private filterColumn(orders: readonly OrderResponse[]): readonly OrderResponse[] {
    const key = this.selectedStation();
    if (key === 'all') {
      return this.assignedPrepAreaIds() === null
        ? orders
        : orders.filter((order) => this.orderInScope(order));
    }
    if (stationAreaId(key) !== null) return orders;
    return orders.filter((order) => orderHasStation(order, key, this.stationMap()));
  }

  /** `true` when the ticket belongs to the active station (server semantics). */
  private matchesSelectedStation(order: OrderResponse): boolean {
    const key = this.selectedStation();
    if (key === 'all') return this.orderInScope(order);
    return orderHasStation(order, key, this.stationMap());
  }

  /** Lines of an order grouped by station, honouring the active station filter. */
  groupsFor(order: OrderResponse): readonly StationGroup<KitchenLine>[] {
    const groups = groupLinesByStation(groupKitchenLines(order.details, this.stationMap()));
    const key = this.selectedStation();
    if (key !== 'all') return groups.filter((group) => group.station.key === key);
    if (this.assignedPrepAreaIds() === null) return groups;
    return groups.filter((group) => this.stationInScope(group.station.key));
  }

  stationItemCount(group: StationGroup<KitchenLine>): number {
    return totalKitchenItems(group.items);
  }

  /** Station headings only earn their place when they disambiguate lines. */
  showStationTitles(order: OrderResponse): boolean {
    return this.selectedStation() === 'all' || this.groupsFor(order).length > 1;
  }

  // ── Labels and timers ─────────────────────────────────────────────────────

  ageMs(order: OrderResponse): number {
    return orderAgeMs(order.date, this.now());
  }

  ageLabel(order: OrderResponse): string {
    return formatAge(this.ageMs(order));
  }

  urgencyFor(order: OrderResponse): KitchenUrgency {
    return urgencyForAge(this.ageMs(order));
  }

  urgencyLabelFor(order: OrderResponse): string {
    return urgencyLabel(this.urgencyFor(order));
  }

  orderTime(order: OrderResponse): string {
    return formatOrderTime(order.date);
  }

  tableLabel(order: OrderResponse): string {
    return order.tableId > 0 ? `Mesa ${String(order.tableId)}` : 'Para llevar';
  }

  columnLabel(column: KitchenColumn): string {
    switch (column) {
      case 'preparing':
        return 'Preparando';
      case 'ready':
        return 'Listos';
      default:
        return 'En cola';
    }
  }

  toggleSound(): void {
    this.alerts.toggle();
  }
}
