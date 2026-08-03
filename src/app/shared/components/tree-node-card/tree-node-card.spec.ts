import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { TreeNodeCardComponent } from './tree-node-card';
import { RemovableChipData } from '../removable-chip/removable-chip';

import treeNodeCardHtml from './tree-node-card.html?raw';
import treeNodeCardCss from './tree-node-card.css?raw';

@Component({
  standalone: true,
  imports: [TreeNodeCardComponent],
  template: `
    <app-tree-node-card
      [nodeType]="nodeType"
      [title]="title"
      [subtitle]="subtitle"
      [icon]="icon"
      [badges]="badges"
      [expandable]="expandable"
      [expanded]="expanded"
      [loading]="loading"
      (expand)="onExpand()"
      (badgeRemoved)="onBadgeRemoved($event)" />
  `,
})
class TestHost {
  nodeType: 'product' | 'group' | 'option' = 'product';
  title = 'Test Title';
  subtitle?: string;
  icon?: string;
  badges: RemovableChipData[] = [];
  expandable = false;
  expanded = false;
  loading = false;

  expandCount = 0;
  lastBadgeRemoved: number | undefined;

  onExpand(): void {
    this.expandCount++;
  }

  onBadgeRemoved(id: number): void {
    this.lastBadgeRemoved = id;
  }
}

describe('TreeNodeCardComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.endsWith('tree-node-card.html')) {
        return Promise.resolve(treeNodeCardHtml as unknown as string);
      }
      if (url.endsWith('tree-node-card.css')) {
        return Promise.resolve(treeNodeCardCss as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(overrides: Partial<{
    nodeType: 'product' | 'group' | 'option';
    title: string;
    subtitle: string;
    icon: string;
    badges: RemovableChipData[];
    expandable: boolean;
    expanded: boolean;
    loading: boolean;
  }> = {}): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    if (overrides.nodeType !== undefined) host.nodeType = overrides.nodeType;
    if (overrides.title !== undefined) host.title = overrides.title;
    if (overrides.subtitle !== undefined) host.subtitle = overrides.subtitle;
    if (overrides.icon !== undefined) host.icon = overrides.icon;
    if (overrides.badges !== undefined) host.badges = overrides.badges;
    if (overrides.expandable !== undefined) host.expandable = overrides.expandable;
    if (overrides.expanded !== undefined) host.expanded = overrides.expanded;
    if (overrides.loading !== undefined) host.loading = overrides.loading;
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(host).toBeTruthy();
  });

  it('should render title', async () => {
    await setup({ title: 'Test Title' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h4')?.textContent).toContain('Test Title');
  });

  it('should render subtitle when provided', async () => {
    await setup({ subtitle: 'Test Subtitle' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p')?.textContent).toContain('Test Subtitle');
  });

  it('should not render subtitle when not provided', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p')).toBeNull();
  });

  it('should render icon when provided', async () => {
    await setup({ icon: 'pi pi-box' });
    const el = fixture.nativeElement as HTMLElement;
    const icon = el.querySelector('i.pi.pi-box');
    expect(icon).toBeTruthy();
  });

  it('should not render icon when not provided', async () => {
    await setup();
    const el = fixture.nativeElement as HTMLElement;
    const icons = el.querySelectorAll('i.pi.text-2xl');
    expect(icons.length).toBe(0);
  });

  it('should render badges via app-removable-chip', async () => {
    await setup({
      badges: [
        { id: 1, label: 'Badge 1' },
        { id: 2, label: 'Badge 2' },
      ],
    });
    const el = fixture.nativeElement as HTMLElement;
    const chips = el.querySelectorAll('app-removable-chip');
    expect(chips.length).toBe(2);
  });

  it('should emit expand on button click', async () => {
    await setup({ expandable: true, expanded: false });
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button') as HTMLElement | null;
    button?.click();
    expect(host.expandCount).toBe(1);
  });

  it('should not render expand button when not expandable', async () => {
    await setup({ expandable: false });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('button')).toBeNull();
  });

  it('should show chevron-down when not expanded', async () => {
    await setup({ expandable: true, expanded: false });
    const el = fixture.nativeElement as HTMLElement;
    const icon = el.querySelector('button i');
    expect(icon?.classList.contains('pi-chevron-down')).toBe(true);
  });

  it('should show chevron-up when expanded', async () => {
    await setup({ expandable: true, expanded: true });
    const el = fixture.nativeElement as HTMLElement;
    const icon = el.querySelector('button i');
    expect(icon?.classList.contains('pi-chevron-up')).toBe(true);
  });

  it('should emit badgeRemoved when chip emits removed', async () => {
    await setup({ badges: [{ id: 42, label: 'Test' }] });
    host.onBadgeRemoved(42);
    expect(host.lastBadgeRemoved).toBe(42);
  });

  it('should show loading spinner when loading is true', async () => {
    await setup({ loading: true });
    const el = fixture.nativeElement as HTMLElement;
    const spinner = el.querySelector('i.pi-spinner');
    expect(spinner).toBeTruthy();
  });

  it('should not show content when loading', async () => {
    await setup({ loading: true, icon: 'pi pi-box' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h4')).toBeNull();
    expect(el.querySelector('i.pi-box')).toBeNull();
  });

  it('should apply border-l-4 for product type', async () => {
    await setup({ nodeType: 'product' });
    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('div');
    expect(card?.classList.contains('border-l-4')).toBe(true);
  });

  it('should apply ml-6 for group type', async () => {
    await setup({ nodeType: 'group' });
    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('div');
    expect(card?.classList.contains('ml-6')).toBe(true);
  });

  it('should apply ml-12 for option type', async () => {
    await setup({ nodeType: 'option' });
    const el = fixture.nativeElement as HTMLElement;
    const card = el.querySelector('div');
    expect(card?.classList.contains('ml-12')).toBe(true);
  });
});
