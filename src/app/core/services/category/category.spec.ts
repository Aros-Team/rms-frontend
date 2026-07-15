import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Category } from './category';
import { CategorySimpleResponse } from '@app/shared/models/dto/category/category-simple-response';

describe('Category service', () => {
  let service: Category;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Category,
      ],
    });

    service = TestBed.inject(Category);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getCategories hits GET v1/categories', () => {
    const expected: CategorySimpleResponse[] = [
      { id: 1, name: 'Bebidas', enabled: true },
      { id: 2, name: 'Postres', enabled: false },
    ];

    let received: CategorySimpleResponse[] | undefined;
    service.getCategories().subscribe(res => { received = res; });

    const req = httpMock.expectOne('v1/categories');
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    req.flush(expected);

    expect(received).toEqual(expected);
  });

  it('createCategory POSTs payload to v1/categories', () => {
    const payload = { name: 'Ensaladas' };

    service.createCategory(payload).subscribe();

    const req = httpMock.expectOne('v1/categories');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('toggleCategory PUTs empty body to v1/categories/{id}/toggle', () => {
    service.toggleCategory(42).subscribe();

    const req = httpMock.expectOne('v1/categories/42/toggle');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({});
  });
});