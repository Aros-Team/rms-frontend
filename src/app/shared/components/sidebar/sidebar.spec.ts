/**
 * Tests for the sidebar drawer behaviour.
 *
 * Feature: desktop navigation must remain usable after the first click.
 * Contract:
 *  - desktop (`isMobile=false`) keeps the sidebar visible and interactive
 *  - the mobile drawer still closes and notifies the layout
 *
 * Regression: `onMenuItemClick` used to close the sidebar unconditionally,
 * which left the desktop sidebar `inert` until a reload.
 */
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeAll, describe, expect, it } from 'vitest';

import { Menu } from '@core/services/menu/menu';
import { Sidebar } from './sidebar';
import sidebarHtml from './sidebar.html?raw';
import { resolveUiResources } from '@shared/ui/testing/ui-test-resources';

describe('Sidebar', () => {
  beforeAll(async () => {
    await resolveUiResources({ 'sidebar.html': sidebarHtml as unknown as string });
  });

  function create(isMobile: boolean): { sidebar: Sidebar; changes: boolean[] } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [Sidebar], providers: [Menu] });
    const sidebar = TestBed.createComponent(Sidebar).componentInstance;
    sidebar.isMobile = isMobile;
    sidebar.visible = true;
    const changes: boolean[] = [];
    sidebar.visibleChange.subscribe((value) => changes.push(value));
    return { sidebar, changes };
  }

  it('keeps the desktop sidebar visible after choosing a section', () => {
    const { sidebar, changes } = create(false);
    sidebar.onMenuItemClick({
      id: 'orders',
      label: 'Pedidos',
      description: 'Pedidos del día',
      routerLink: '/admin/orders',
    });

    expect(sidebar.visible).toBe(true);
    expect(changes).toEqual([]);
  });

  it('closes the mobile drawer after choosing a section', () => {
    const { sidebar, changes } = create(true);
    sidebar.onMenuItemClick({
      id: 'orders',
      label: 'Pedidos',
      description: 'Pedidos del día',
      routerLink: '/admin/orders',
    });

    expect(sidebar.visible).toBe(false);
    expect(changes).toEqual([false]);
  });

  it('turns the navigation into a matrix only while expanded', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [Menu, provideRouter([])],
    });
    const fixture = TestBed.createComponent(Sidebar);
    const sidebar = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    sidebar.visible = true;
    sidebar.isMobile = false;
    TestBed.inject(Menu).setMenuItems([
      { id: 'dashboard', label: 'Dashboard', description: '', routerLink: '/admin' },
      { id: 'orders', label: 'Pedidos', description: '', routerLink: '/admin/orders' },
    ]);
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();

    expect(element.querySelector('.nav-grid--expanded')).not.toBeNull();
    expect(element.querySelectorAll('.nav-grid .nav-tile__label').length).toBe(2);

    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();

    expect(element.querySelector('.nav-grid--expanded')).toBeNull();
  });
});
