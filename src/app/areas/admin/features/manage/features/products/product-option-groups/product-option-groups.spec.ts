/**
 * Tests for the OptionGroupsView component.
 *
 * Feature: Displays and manages option groups for a product.
 * Contract: Loads option groups via HTTP, renders tree, supports CRUD operations.
 * Approach: Mount component via TestBed with HttpTestingController, assert rendered tree nodes.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';
import { TreeNode } from 'primeng/api';

import { OptionGroupsView, OrgChartData } from './product-option-groups';
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

function makeNode(data: OrgChartData, children: TreeNode<OrgChartData>[] = []): TreeNode<OrgChartData> {
  return { label: '', data, children };
}

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

    // Flush the ngOnInit loadProducts() request with paginated response shape
    const initReq = httpMock.expectOne(r => r.url === 'v1/products');
    initReq.flush({ content: [mockProduct], page: { number: 0, size: 100, totalElements: 1, totalPages: 1 } });
    fixture.detectChanges();
  }

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('should load products on init', async () => {
    await setup();
    expect(component.products().length).toBe(1);
    expect(component.products()[0].name).toBe('Hamburguesa');
  });

  it('should expand product and load groups + options', async () => {
    await setup();

    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    expect(groupsReq.request.method).toBe('GET');
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    expect(optionsReq.request.method).toBe('GET');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    expect(component.isProductLoading(10)).toBe(false);
  });

  it('should collapse product', async () => {
    await setup();

    // Expand first
    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    // Collapse
    component.onNodeCollapse({ node: productNode });
    fixture.detectChanges();

    // After collapse, chartData should rebuild without the expanded key
    const chartNodes = component.chartData();
    expect(chartNodes.length).toBe(1);
    expect(chartNodes[0].expanded).toBe(false);
  });

  it('should toggle group expand via onNodeExpand', async () => {
    await setup();

    // First expand the product to load groups
    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    // Now expand the group
    const groupNode = makeNode({ nodeType: 'group', group: mockGroup, product: mockProduct });
    component.onNodeExpand({ node: groupNode });
    fixture.detectChanges();

    // No error, group key added to expanded set
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
    expect(fields.length).toBe(1);
    expect(fields[0].name).toBe('name');
  });

  it('should create group via onCreateGroup', async () => {
    await setup();

    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    component.onCreateGroup(10, {
      name: 'Adiciones',
      selectionType: 'ADD_ON',
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

    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.flush([mockGroup]);

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.flush([mockOption]);

    fixture.detectChanges();

    component.onCreateOption(1, { name: 'Aguacate' });

    const createReq = httpMock.expectOne('v1/product-options');
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ id: 102, name: 'Aguacate', optionGroupId: 1 });

    const reloadReq = httpMock.expectOne('v1/products/10/options');
    reloadReq.flush([mockOption, { ...mockOption, id: 102, name: 'Aguacate' }]);

    fixture.detectChanges();
  });

  it('should build chartData with product nodes', async () => {
    await setup();
    fixture.detectChanges();

    const nodes = component.chartData();
    expect(nodes.length).toBe(1);
    expect(nodes[0].data?.nodeType).toBe('product');
  });

  it('should handle error when loading products', async () => {
    await setup();

    // Call loadProducts again to get a request we can fail
    component.loadProducts();
    const req = httpMock.expectOne(r => r.url === 'v1/products');
    req.error(new ProgressEvent('error'));
    fixture.detectChanges();
    fixture.detectChanges();

    expect(component.products().length).toBe(0);
  });

  it('should handle error when expanding product', async () => {
    await setup();

    const productNode = makeNode({ nodeType: 'product', product: mockProduct });
    component.onNodeExpand({ node: productNode });
    fixture.detectChanges();

    const groupsReq = httpMock.expectOne(r =>
      r.url === 'v1/option-groups' && r.params.get('productId') === '10'
    );
    groupsReq.error(new ProgressEvent('error'));

    const optionsReq = httpMock.expectOne('v1/products/10/options');
    optionsReq.error(new ProgressEvent('error'));

    fixture.detectChanges();

    expect(component.isProductLoading(10)).toBe(false);
  });

  it('should not expand if node data is missing', async () => {
    await setup();
    component.onNodeExpand({ node: {} as TreeNode<OrgChartData> });
    component.onNodeCollapse({ node: {} as TreeNode<OrgChartData> });
  });

  it('should handle group node expand', async () => {
    await setup();
    const groupNode = makeNode({ nodeType: 'group', group: mockGroup, product: mockProduct });
    component.onNodeExpand({ node: groupNode });
  });

  it('should handle group node collapse', async () => {
    await setup();
    const groupNode = makeNode({ nodeType: 'group', group: mockGroup, product: mockProduct });
    component.onNodeCollapse({ node: groupNode });
  });
});
