import { ɵresolveComponentResources as resolveComponentResources, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { TreeNodeSkeletonComponent } from './tree-node-skeleton';

import treeNodeSkeletonHtml from './tree-node-skeleton.html?raw';

@Component({
  standalone: true,
  imports: [TreeNodeSkeletonComponent],
  template: `<app-tree-node-skeleton [depth]="depth" [count]="count" />`,
})
class TestHost {
  depth = 1;
  count = 1;
}

describe('TreeNodeSkeletonComponent', () => {
  beforeAll(async () => {
    await resolveComponentResources((url: string) => {
      if (url.includes('tree-node-skeleton.html')) {
        return Promise.resolve(treeNodeSkeletonHtml as unknown as string);
      }
      return Promise.resolve('');
    });
  });

  async function setup(depth: number, count: number): Promise<ComponentFixture<TestHost>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.depth = depth;
    fixture.componentInstance.count = count;
    fixture.detectChanges();
    return fixture;
  }

  it('should create', async () => {
    const fixture = await setup(1, 1);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have selector app-tree-node-skeleton', async () => {
    const fixture = await setup(1, 1);
    const el = (fixture.nativeElement as HTMLElement).querySelector('app-tree-node-skeleton');
    expect(el).toBeTruthy();
  });

  describe('depth', () => {
    it('should render with 24px padding-left when depth=1 (default)', async () => {
      const fixture = await setup(1, 1);
      const container = fixture.debugElement.query(By.css('div'));
      expect((container.nativeElement as HTMLElement).style.paddingLeft).toBe('24px');
    });

    it('should render with 48px padding-left when depth=2', async () => {
      const fixture = await setup(2, 1);
      const container = fixture.debugElement.query(By.css('div'));
      expect((container.nativeElement as HTMLElement).style.paddingLeft).toBe('48px');
    });

    it('should render with 72px padding-left when depth=3', async () => {
      const fixture = await setup(3, 1);
      const container = fixture.debugElement.query(By.css('div'));
      expect((container.nativeElement as HTMLElement).style.paddingLeft).toBe('72px');
    });
  });

  describe('count', () => {
    it('should render 1 skeleton item by default', async () => {
      const fixture = await setup(1, 1);
      const items = fixture.debugElement.queryAll(By.css('.rounded-lg'));
      expect(items.length).toBe(1);
    });

    it('should render 3 skeleton items when count=3', async () => {
      const fixture = await setup(1, 3);
      const items = fixture.debugElement.queryAll(By.css('.rounded-lg'));
      expect(items.length).toBe(3);
    });

    it('should render 5 skeleton items when count=5', async () => {
      const fixture = await setup(1, 5);
      const items = fixture.debugElement.queryAll(By.css('.rounded-lg'));
      expect(items.length).toBe(5);
    });
  });

  describe('skeleton elements per item', () => {
    it('should show 1 circle skeleton + 2 line skeletons per item', async () => {
      const fixture = await setup(1, 2);
      const items = fixture.debugElement.queryAll(By.css('.rounded-lg'));
      items.forEach((item) => {
        const skeletons = item.queryAll(By.css('p-skeleton'));
        expect(skeletons.length).toBe(3);

        const circleSkeleton = skeletons[0].componentInstance as { shape: string; width: string; height: string };
        expect(circleSkeleton.shape).toBe('circle');
        expect(circleSkeleton.width).toBe('40px');
        expect(circleSkeleton.height).toBe('40px');
      });
    });

    it('should have correct dimensions for line skeletons', async () => {
      const fixture = await setup(1, 1);
      const item = fixture.debugElement.query(By.css('.rounded-lg'));
      const skeletons = item.queryAll(By.css('p-skeleton'));

      const skeleton1 = skeletons[1].componentInstance as { width: string; height: string };
      expect(skeleton1.width).toBe('60%');
      expect(skeleton1.height).toBe('16px');

      const skeleton2 = skeletons[2].componentInstance as { width: string; height: string };
      expect(skeleton2.width).toBe('40%');
      expect(skeleton2.height).toBe('12px');
    });
  });

  describe('items getter', () => {
    it('should return array of correct length', async () => {
      const fixture = await setup(1, 4);
      const comp = fixture.debugElement.children[0].componentInstance as TreeNodeSkeletonComponent;
      expect(comp.items.length).toBe(4);
      expect(comp.items).toEqual([0, 1, 2, 3]);
    });

    it('should return empty array when count=0', async () => {
      const fixture = await setup(1, 0);
      const comp = fixture.debugElement.children[0].componentInstance as TreeNodeSkeletonComponent;
      expect(comp.items).toEqual([]);
    });
  });
});
