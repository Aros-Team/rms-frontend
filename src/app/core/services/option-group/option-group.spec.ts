/**
 * Tests for the OptionGroup HTTP service.
 *
 * Feature: CRUD operations for option groups via HTTP.
 * Contract: Makes correct GET/POST/PUT/DELETE requests with proper URLs and bodies.
 * Approach: Use HttpTestingController to intercept requests, assert method, URL, and body.
 */
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { OptionGroup } from './option-group';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';

describe('OptionGroup service', () => {
  let service: OptionGroup;
  let httpMock: HttpTestingController;

  const mockGroup: OptionGroupResponse = {
    id: 1,
    name: 'Toppings',
    description: 'Elige tus toppings',
    selectionType: 'SINGLE_CHOICE',
    productIds: [10, 11],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OptionGroup,
      ],
    });

    service = TestBed.inject(OptionGroup);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getOptionGroups() hits GET v1/option-groups without query params', () => {
    service.getOptionGroups().subscribe();

    const req = httpMock.expectOne('v1/option-groups');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([]);
  });

  it('getOptionGroups(search) adds search param', () => {
    service.getOptionGroups('pizza').subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('search') === 'pizza'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getProductOptionGroups(productId) hits GET v1/option-groups?productId={id}', () => {
    service.getProductOptionGroups(5).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '5'
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockGroup]);
  });

  it('getOptionGroup(id) hits GET v1/option-groups/{id}', () => {
    service.getOptionGroup(1).subscribe();

    const req = httpMock.expectOne('v1/option-groups/1');
    expect(req.request.method).toBe('GET');
    req.flush(mockGroup);
  });

  it('createOptionGroup POSTs payload to v1/option-groups', () => {
    const payload = {
      name: 'Adiciones',
      productIds: [10],
      selectionType: 'ADD_ON' as const,
    };

    service.createOptionGroup(payload).subscribe();

    const req = httpMock.expectOne('v1/option-groups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockGroup);
  });

  it('updateOptionGroup PUTs payload to v1/option-groups/{id}', () => {
    const payload = {
      name: 'Updated',
      productIds: [10],
    };

    service.updateOptionGroup(1, payload).subscribe();

    const req = httpMock.expectOne('v1/option-groups/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockGroup);
  });
});
