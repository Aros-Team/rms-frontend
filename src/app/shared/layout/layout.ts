import { Component, OnInit, OnDestroy, inject, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Header, HorizontalMenuOption } from '../components/header/header';
import { Sidebar } from '../components/sidebar/sidebar';
import { MenuService } from '../../core/services/menu/menu-service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, Header, Sidebar],
  templateUrl: './layout.html',
  styles: ``
})
export class Layout implements OnInit, OnDestroy {
  @Input() workerType?: string;
  @Input() hideSidebar = false;

  sidebarVisible = false;
  isMobile = false;
  horizontalMenuOptions: HorizontalMenuOption[] = [];

  private resizeSubscription!: Subscription;
  private routerSubscription!: Subscription;
  private menuService = inject(MenuService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  ngOnInit(): void {
    this.checkScreenSize();
    this.setupResizeListener();
    this.configureHorizontalMenu();
    this.setupRouterListener();

    if (this.hideSidebar) {
      this.sidebarVisible = false;
    }
  }

  ngOnDestroy(): void {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  private checkScreenSize(): void {
    this.isMobile = window.innerWidth < 1024;
    this.sidebarVisible = !this.isMobile && !this.hideSidebar;
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      this.checkScreenSize();
    });
  }

  private configureHorizontalMenu(): void {
    this.menuService.menuItems$.subscribe(items => {
      this.horizontalMenuOptions = items.map(item => ({
        id: item.id,
        label: item.label,
        description: item.description,
        icon: item.icon,
        routerLink: item.routerLink
      }));
      this.cdr.detectChanges();
    });
  }

  private setupRouterListener(): void {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cdr.detectChanges();
    });
  }

  toggleSidebar(): void {
    if (!this.hideSidebar) {
      this.sidebarVisible = !this.sidebarVisible;
    }
  }

  onSidebarVisibleChange(visible: boolean): void {
    this.sidebarVisible = visible;
  }
}
