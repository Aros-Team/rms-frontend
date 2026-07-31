import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { Product } from './product';
import { PaginatedProductsResponse } from './product';
import { ProductCreateRequest } from '@app/shared/models/dto/products/product-create-request';
import { ProductUpdateRequest } from '@app/shared/models/dto/products/product-update-request';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { ProductCostResponse } from '@app/shared/models/dto/products/product-cost-response';

describe('Product service', () => {
  let service: Product;
  let httpMock: HttpTestingController;

  const mockProduct: ProductResponse = {
    id: 7,
    name: 'Combo Almuerzo',
    basePrice: 12.5,
    active: true,
    categoryId: 2,
    categoryName: 'Combos',
    areaId: 1,
    areaName: 'Cocina',
    recipe: [],
    selectionType: 'SPECIAL_SELECTION',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        Product,
      ],
    });

    service = TestBed.inject(Product);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getProducts() hits GET v1/products without query params', () => {
    service.getProducts().subscribe();

    const req = httpMock.expectOne('v1/products');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush([]);
  });

  it('getProducts(true) hits GET v1/products?includeSelections=true', () => {
    service.getProducts(true).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    );
    expect(req.request.method).toBe('GET');
    req.flush([mockProduct]);
  });

  it('getProducts(false) does not add includeSelections param', () => {
    service.getProducts(false).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/products' && !r.params.has('includeSelections')
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getAllProducts(true) hits GET v1/products?includeSelections=true', () => {
    service.getAllProducts(true).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/products' && r.params.get('includeSelections') === 'true'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getProductsByCategories merges category filter with includeSelections', () => {
    service.getProductsByCategories([2, 5], true).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/products' &&
      r.params.get('categories') === '2,5' &&
      r.params.get('includeSelections') === 'true'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('filterByCategories hits GET v1/products with categories param', () => {
    service.filterByCategories([2, 5]).subscribe();

    const req = httpMock.expectOne(r =>
      r.url === 'v1/products' && r.params.get('categories') === '2,5'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('createProduct POSTs payload with categoryId to v1/products', () => {
    const payload: ProductCreateRequest = {
      name: 'Lentejas',
      basePrice: 8.5,
      categoryId: 3,
      areaId: 1,
      recipe: [],
    };

    service.createProduct(payload).subscribe();

    const req = httpMock.expectOne('v1/products');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockProduct);
  });

  it('updateProduct PUTs payload with categoryId to v1/products/{id}', () => {
    const payload: ProductUpdateRequest = {
      name: 'Lentejas',
      basePrice: 8.5,
      categoryId: 3,
      areaId: 1,
    };

    service.updateProduct(7, payload).subscribe();

    const req = httpMock.expectOne('v1/products/7');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('findProduct hits GET v1/products/{id}', () => {
    service.findProduct(7).subscribe();

    const req = httpMock.expectOne('v1/products/7');
    expect(req.request.method).toBe('GET');
    req.flush(mockProduct);
  });

  it('getCost hits GET v1/products/{id}/cost and emits payload', () => {
    const mockCost: ProductCostResponse = {
      productId: 1,
      totalCost: 25.75,
      materialCost: 15.5,
      laborCost: 10.25,
      breakdown: [
        { description: 'Material: variant 3', amount: 15.5, type: 'MATERIAL' },
      ],
    };

    let emitted: ProductCostResponse | undefined;
    service.getCost(1).subscribe(value => {
      emitted = value;
    });

    const req = httpMock.expectOne('v1/products/1/cost');
    expect(req.request.method).toBe('GET');
    req.flush(mockCost);

    expect(emitted).toEqual(mockCost);
  });

  it('disableProduct PUTs empty body to v1/products/{id}/disable', () => {
    service.disableProduct(7).subscribe();

    const req = httpMock.expectOne('v1/products/7/disable');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  describe('enableProduct', () => {
    it('PUTs empty body to v1/products/{id}/enable', () => {
      service.enableProduct(7).subscribe();

      const req = httpMock.expectOne('v1/products/7/enable');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({});
      req.flush({});
    });
  });

  it('deleteProduct DELETEs v1/products/{id}', () => {
    service.deleteProduct(7).subscribe();

    const req = httpMock.expectOne('v1/products/7');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  describe('getProductsPaginated', () => {
    it('flattens nested page metadata into flat paginated response', () => {
      let emitted: PaginatedProductsResponse | undefined;
      service.getProductsPaginated(1, 6, false, true).subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/products' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '6' &&
        r.params.get('includeInactive') === 'false' &&
        r.params.get('includeSelections') === 'true'
      );
      expect(req.request.method).toBe('GET');

      const lentejas: ProductResponse = {
        id: 7,
        name: 'Lentejas',
        basePrice: 12.5,
        active: true,
        categoryId: 2,
        categoryName: 'Comidas',
        areaId: 1,
        areaName: 'Cocina',
        recipe: [],
      };

      req.flush({
        content: [lentejas],
        page: { size: 6, number: 1, totalElements: 42, totalPages: 7 },
      });

      expect(emitted).toEqual({
        content: [lentejas],
        totalElements: 42,
        totalPages: 7,
        page: 1,
        size: 6,
      });
    });

    it('falls back to empty defaults when page metadata is missing', () => {
      let emitted: PaginatedProductsResponse | undefined;
      service.getProductsPaginated(1, 6, false, true).subscribe(value => {
        emitted = value;
      });

      const req = httpMock.expectOne(r =>
        r.url === 'v1/products' &&
        r.params.get('page') === '1' &&
        r.params.get('size') === '6'
      );
      req.flush({});

      expect(emitted).toEqual({
        content: [],
        totalElements: 0,
        totalPages: 0,
        page: 0,
        size: 0,
      });
    });
  });
});