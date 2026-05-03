import { Component, OnInit, OnDestroy, inject, Input, ChangeDetectorRef, ViewChild, ChangeDetectionStrategy } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Header, HorizontalMenuOption } from '../components/header/header';
import { Sidebar } from '../components/sidebar/sidebar';
import { Chat } from '@app/areas/admin/features/chat/chat';
import { Menu } from '@app/core/services/menu/menu';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Header, Sidebar, Chat],
  templateUrl: './layout.html',
  styles: ``
})
export class Layout implements OnInit, OnDestroy {
  @Input() workerType?: string;
  @Input() hideSidebar = false;
  @Input() role?: string;
  @ViewChild(Chat) chatComponent!: Chat;

  sidebarVisible = false;
  isMobile = false;
  isTablet = false;
  horizontalMenuOptions: HorizontalMenuOption[] = [];

  private resizeSubscription!: Subscription;
  private routerSubscription!: Subscription;
  private resizeHandler!: () => void;
  private menuService = inject(Menu);
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
    this.resizeSubscription.unsubscribe();
    this.routerSubscription.unsubscribe();
    window.removeEventListener('resize', this.resizeHandler);
  }

  private checkScreenSize(): void {
    const width = window.innerWidth;
    this.isMobile = width < 768;
    this.isTablet = width >= 768 && width < 1024;
    this.sidebarVisible = !this.isMobile && !this.hideSidebar;
  }

  private setupResizeListener(): void {
    this.resizeHandler = () => { this.checkScreenSize(); };
    window.addEventListener('resize', this.resizeHandler);
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
      this.cdr.markForCheck();
    });
  }

  private setupRouterListener(): void {
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.cdr.markForCheck();
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

  chatVisible = false;

  toggleChat(): void {
    this.chatComponent.toggleChat();
  }
}
