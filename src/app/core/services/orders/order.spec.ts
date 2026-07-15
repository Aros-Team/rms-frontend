import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { Logging } from '@app/core/services/logging/logging';
import { Order } from '@app/core/services/orders/order';
import type { CreateOrderRequest } from '@app/shared/models/dto/orders/create-order-request.model';
import type { OrderResponse } from '@app/shared/models/dto/orders/order-response.model';

describe('Order', () => {
  let service: Order;
  let httpMock: HttpTestingController;
  let logMock: { debug: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logMock = { debug: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Order,
        { provide: Logging, useValue: logMock },
      ],
    });

    service = TestBed.inject(Order);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('preserves selectedProductIds in create-order request details', () => {
    const request: CreateOrderRequest = {
      tableId: 8,
      details: [
        {
          productId: 50,
          instructions: 'Sin salsa',
          selectedOptionIds: [700],
          selectedProductIds: [201, 202],
          additionIds: [900],
          clarifications: [{ questionId: 10, answer: 'Término medio' }],
        },
      ],
    };
    const response: OrderResponse = {
      id: 99,
      date: '2026-07-15T12:00:00',
      status: 'QUEUE',
      tableId: 8,
      details: [],
    };
    const next = vi.fn();

    service.createOrder(request).subscribe(next);

    const req = httpMock.expectOne('v1/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    const body = req.request.body as CreateOrderRequest;
    expect(body.details[0].selectedProductIds).toEqual([201, 202]);
    req.flush(response);

    expect(next).toHaveBeenCalledWith(response);
  });
});
