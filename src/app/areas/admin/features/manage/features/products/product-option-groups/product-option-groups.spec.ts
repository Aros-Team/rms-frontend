import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

import { OptionGroupsView } from './product-option-groups';
import { ProductResponse } from '@app/shared/models/dto/products/product-response';
import { OptionGroupResponse } from '@app/shared/models/dto/option-groups/option-group';
import { ProductOption } from '@app/shared/models/dto/products/product-option';

import optionGroupsViewHtml from './product-option-groups.html?raw';
import optionGroupsViewCss from './product-option-groups.css?raw';

const mockProduct: ProductResponse = {
  id: 10,
  name: 'Hamburguesa',
  basePrice: 25000,
  active: true,
  categoryId: 2,
  categoryName: 'Comidas',
  areaId: 1,
  areaName: 'Cocina',
  recipe: [],
  optionGroupIds: [1, 2],
};

const mockGroup: OptionGroupResponse = {
  id: 1,
  name: 'Toppings',
  description: 'Elige tus toppings',
  selectionType: 'SINGLE_CHOICE',
  productIds: [10],
};

const mockOption: ProductOption = {
  id: 101,
  name: 'Tocineta',
  optionGroupId: 1,
  optionGroupName: 'Toppings',
  cost: { amount: 2000, currency: 'COP' },
  extraPrice: { amount: 3000, currency: 'COP' },
};

describe('OptionGroupsView', () => {
  let fixture: ComponentFixture<OptionGroupsView>;
  let component: OptionGroupsView;
  let httpMock: HttpTestingController;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('product-option-groups.html')) {
        return Promise.resolve(optionGroupsViewHtml as unknown as string);
      }
      if (url.endsWith('product-option-groups.css')) {
        return Promise.resolve(optionGroupsViewCss as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OptionGroupsView],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionGroupsView);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('should load products on loadProducts()', async () => {
    await setup();
    component.loadProducts();

    const req = httpMock.expectOne('v1/products');
    expect(req.request.method).toBe('GET');
    req.flush([mockProduct]);

    expect(component.products().length).toBe(1);
    expect(component.products()[0].name).toBe('Hamburguesa');
  });

  it('should show empty state when no products', async () => {
    await setup();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const emptyState = el.querySelector('.text-surface-500');
    expect(emptyState).toBeTruthy();
  });

  it('should lazy-load groups and options on product expand', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    // Toggle product expand
    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    // Should request groups and options
    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    expect(groupsReq.request.method).toBe('GET');
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    expect(optionsReq.request.method).toBe('GET');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    expect(component.isProductExpanded(10)).toBe(true);
    expect(component.getGroupsForProduct(10).length).toBe(1);
    expect(component.getOptionsForGroup(1).length).toBe(1);
  });

  it('should collapse product on second toggle', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    // Expand
    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    // Collapse
    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    expect(component.isProductExpanded(10)).toBe(false);
  });

  it('should toggle group expand/collapse', async () => {
    await setup();

    // Expand group
    component.toggleGroup(mockGroup);
    expect(component.isGroupExpanded(1)).toBe(true);

    // Collapse group
    component.toggleGroup(mockGroup);
    expect(component.isGroupExpanded(1)).toBe(false);
  });

  it('should bucket options by optionGroupId', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    const options = component.getOptionsForGroup(1);
    expect(options.length).toBe(1);
    expect(options[0].name).toBe('Tocineta');
  });

  it('should build tree nodes with correct types', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    // Expand group
    component.toggleGroup(mockGroup);
    fixture.detectChanges();

    const nodes = component.treeNodes();
    expect(nodes.length).toBe(3);
    expect(nodes[0].type).toBe('product');
    expect(nodes[1].type).toBe('group');
    expect(nodes[2].type).toBe('option');
  });

  it('should create group via onCreateGroup', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    component.toggleProduct(mockProduct);

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    component.onCreateGroup(10, {
      name: 'Adiciones',
      selectionType: 'EXTRA',
      description: 'Adds extra items',
    });

    const createReq = httpMock.expectOne('v1/option-groups');
    expect(createReq.request.method).toBe('POST');
    expect((createReq.request.body as { name: string }).name).toBe('Adiciones');
    createReq.flush({ ...mockGroup, id: 3, name: 'Adiciones' });

    const reloadReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    reloadReq.flush([mockGroup]);

    fixture.detectChanges();
  });

  it('should create option via onCreateOption', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    component.toggleProduct(mockProduct);

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    component.onCreateOption(1, { name: 'Aguacate', cost: 1500, extraPrice: 2000 });

    const createReq = httpMock.expectOne('v1/product-options');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ id: 102, name: 'Aguacate', optionGroupId: 1 });

    const reloadReq = httpMock.expectOne('v1/products/10/options');
    reloadReq.flush([mockOption, { ...mockOption, id: 102, name: 'Aguacate' }]);

    fixture.detectChanges();
  });

  it('should format money correctly', async () => {
    await setup();
    expect(component.formatMoney(25000)).toBe('$25.000');
    expect(component.formatMoney(0)).toBe('$0');
    expect(component.formatMoney(undefined)).toBe('$0');
    expect(component.formatMoney(null)).toBe('$0');
  });

  it('should get correct selection type from group', async () => {
    await setup();
    const type = component.getSelectionType(mockGroup);
    expect(type).toBe('SINGLE_CHOICE');
  });

  it('should have group fields configured', async () => {
    await setup();
    const fields = component.groupFields;
    expect(fields.length).toBe(3);
    expect(fields[0].name).toBe('name');
    expect(fields[1].name).toBe('selectionType');
    expect(fields[1].type).toBe('select');
    expect(fields[2].name).toBe('description');
  });

  it('should have option fields configured', async () => {
    await setup();
    const fields = component.optionFields;
    expect(fields.length).toBe(3);
    expect(fields[0].name).toBe('name');
    expect(fields[1].name).toBe('cost');
    expect(fields[2].name).toBe('extraPrice');
  });

  it('should render product card when products loaded', async () => {
    await setup();
    component.loadProducts();

    const req = httpMock.expectOne('v1/products');
    req.flush([mockProduct]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const cards = el.querySelectorAll('app-tree-node-card');
    expect(cards.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle error when loading products', async () => {
    await setup();
    component.loadProducts();

    const req = httpMock.expectOne('v1/products');
    req.error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(component.products().length).toBe(0);
  });

  it('should handle error when expanding product', async () => {
    await setup();
    component.loadProducts();

    const productsReq = httpMock.expectOne('v1/products');
    productsReq.flush([mockProduct]);

    component.toggleProduct(mockProduct);
    fixture.detectChanges();

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.error(new ProgressEvent('error'));

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.error(new ProgressEvent('error'));

    fixture.detectChanges();

    expect(component.isProductExpanded(10)).toBe(true);
    expect(component.getGroupsForProduct(10).length).toBe(0);
  });
});
